import { Source } from "../source";
import { Item, Collection } from "../types";
import * as query from "../query";

import { IDatabase } from "pg-promise";
import { badData } from "boom";
import * as _squel from "squel";
import { Select, Update, Delete, Expression, Insert } from "squel";
import { notFound } from "boom";

import { omit, assocPath, path, identity, map } from "ramda";
import { ValidationFailurePayload } from "../schema";

export interface Options {
  joinMarker: string;
}

const squel = _squel.useFlavour("postgres");

// Allow Arrays to be passed straight through and let pgPromise to handle type conversion
(squel as any).registerValueHandler(Array, identity);

const DEFAULT_OPTIONS: Options = {
  joinMarker: "Δ"
};

export class PostgreSQL implements Source {
  protected _options: Options;

  constructor(readonly db: IDatabase<any>, options?: Partial<Options>) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  create<T extends query.Create, R extends Item | Collection>(query: T): Promise<R> {
    const { text, values } = this.createQuery(query).toParam();

    return this.db.oneOrNone(text, values)
      .catch(handleConstraintViolation) as any;
  }

  createQuery<T extends query.Create>(query: T): Insert {
    const result = squel.insert()
      .into(query.source)
      .returning(query.returning.join(","));

    this._withJoins(result, query);
    this._setValues(result, query.data);

    return result;
  }

  async read<T extends query.Read, R extends Item | Collection>(query: T): Promise<R> {
    const readQuery = this.readQuery(query).toParam();

    if (query.return === "item") {
      const result = await this.db.oneOrNone(readQuery.text, readQuery.values);

      if (result === null) {
        throw notFound();
      }

      return this._mergeJoins(result, query) as R;
    }

    const countQuery = this.countQuery(query).toParam();

    const items = this.db.manyOrNone(readQuery.text, readQuery.values)
      .then(results => results.map(
        result => this._mergeJoins(result, query)
      ));

    const count = this.db.one(countQuery.text, countQuery.values)
      .then(result => parseInt(result.count, 10));

    return Promise
      .all([items, count])
      .then(([items, count]) => ({ items, count })) as Promise<R>;
  }

  readQuery<T extends query.Read>(query: T): Select {
    const result = squel.select()
      .from(query.source);

    this._addFields(result, query);
    this._addConditions(result, query);
    this._addOrder(result, query);
    this._addJoins(result, query);

    if (query.return === "collection") {
      this._addPages(result, query);
    }

    return result;
  }

  countQuery<T extends query.Read>(query: T): Select {
    const result = squel.select()
      .from(query.source)
      .field(`COUNT(*)`);

    this._addConditions(result, query);
    this._addJoins(result, query, true);

    return result;
  }

  update<T extends query.Update, R extends Item | Collection>(query: T): Promise<R> {
    const { text, values } = this.updateQuery(query).toParam();

    return this.db.oneOrNone(text, values)
      .catch(handleConstraintViolation) as any;
  }

  updateQuery<T extends query.Update>(query: T): Update {
    const result = squel.update()
      .table(query.source)
      .returning(query.returning.join(","));

    this._addConditions(result, query);
    this._withJoins(result, query);
    this._setValues(result, query.data);

    return result;
  }

  delete<T extends query.Delete>(query: T): Promise<boolean> {
    const { text, values } = this.deleteQuery(query).toParam();

    return this.db.result(text, values)
      .then(result => {
        if (result.rowCount === 0) {
          throw notFound();
        }

        return true;
      }) as any;
  }

  deleteQuery<T extends query.Delete>(query: T): Delete {
    const result = squel.delete()
      .from(query.source);

    this._addConditions(result, query);

    return result;
  }

  protected _addPages(sql: Select, query: query.Read): void {
    if (query.page) {
      sql.limit(query.page.size);
      sql.offset(query.page.size * (query.page.number - 1));
    }
  }

  protected _addFields(sql: Select, query: query.Read): void {
    if (query.fields) {
      let fields = query.fields.map(field => {
        if ((field as query.Raw).$raw) {
          return (field as query.Raw).$raw.fragment;
        }

        return `${query.source}.${field}`;
      });

      sql.fields(fields);
    } else {
      sql.field(`${query.source}.*`);
    }
  }

  protected _addConditions(sql: Select | Update | Delete, query: query.Read | query.Update | query.Delete): void {
    const applyExpression = (target: any, method: "where" | "and" | "or", expression: Expression | [string, any]) => {
      if (expression instanceof Array) {
        const [fragment, values] = expression;

        if (values instanceof Array) {
          return target[method](fragment, ...values);
        }

        return target[method](fragment, values);
      }

      target[method](expression);
    };

    const buildExpression = (condition: query.Condition): _squel.Expression | [string, any] => {
      let expr = squel.expr();

      if ((condition as query.ConditionAnd).$and) {
        (condition as query.ConditionAnd).$and.forEach(condition => {
          applyExpression(expr, "and", buildExpression(condition));
        });

        return expr;
      }

      if ((condition as query.ConditionOr).$or) {
        (condition as query.ConditionOr).$or.forEach(condition => {
          applyExpression(expr, "or", buildExpression(condition));
        });

        return expr;
      }

      if ((condition as query.Raw).$raw) {
        let { fragment, values } = (condition as query.Raw).$raw;
        return [fragment, values];
      }

      condition = condition as query.ConditionTerm;
      let operator = condition.operator || "=";
      let fieldParts = condition.field.split(".");
      let fieldPath = fieldParts.slice(0, -1).join(this._options.joinMarker) + "." + fieldParts.slice(-1);

      return [
        `${query.source}${fieldPath} ${operator} ?`,
        condition.value
      ];
    };

    if (query.conditions) {
      query.conditions.forEach(condition => {
        applyExpression(sql, "where", buildExpression(condition));
      });
    }
  }

  protected _addOrder(sql: _squel.Select, query: query.Read): void {
    if (query.order) {
      query.order.forEach(order => {
        sql.order(order.field, order.direction.toLowerCase() === "asc");
      });
    }
  }

  protected _addJoins(sql: _squel.Select, query: query.Read, counting?: boolean) {
    if (query.joins) {
      query.joins.forEach(join => {
        let alias = join.path.join(this._options.joinMarker);
        let self = join.path.slice(0, -1).join(this._options.joinMarker);
        sql.left_join(join.source, alias, `${alias}.${join.to} = ${self}.${join.from}`);

        if (!counting && join.nest !== false) {
          sql.field(`row_to_json(${alias}.*) AS ${alias}`);
        }
      });
    }
  }

  protected _mergeJoins(result: Item, query: query.Read): Item {
    if (!query.joins) {
      return result;
    }

    return query.joins.reduce((result, join) => {
      let path = join.path.slice(1);
      let key = join.path.join(this._options.joinMarker);

      if (result[key]) {
        result = assocPath(path, result[key], result);
      }

      return omit([key], result);
    }, result);
  }

  protected _withJoins(sql: _squel.Update | _squel.Insert, query: query.Create | query.Update) {
    if (!query.joins) {
      return;
    }

    query.joins
      .sort(join => join.path.length)
      .forEach(join => {
        let nested = path(join.path, query.data);

        if (typeof nested !== "object") {
          return;
        }

        let alias = join.path.join(this._options.joinMarker);

        let insert = squel.insert()
          .into(join.source)
          .returning(join.to);

        this._setValues(insert, nested);

        (sql as any).with(alias, insert);

        let select = squel.select()
          .from(alias)
          .field(join.to);

        query.data = assocPath(join.path, select, query.data);
      });
  }

  protected _setValues(sql: _squel.Update | _squel.Insert, data: any) {
    // @hack: Squel flattens top-level array values, so wrap them in an additional array
    let fields = map<any, string>(value => value instanceof Array ? [value] : value, data);
    sql.setFields(fields);
  }
}

const handleConstraintViolation = (error: any): never => {
  if (error.routine !== "ri_ReportViolation" || !error.detail) {
    throw error;
  }

  const re = /^Key \((.+?)\)=\(\d+\) is not present in table ".+?"\.$/;
  let [detail, key] = error.detail.match(re);

  if (!key) {
    throw error;
  }

  let err = badData();
  (err.output.payload as ValidationFailurePayload).errors = [{
    message: "Constraint violation",
    dataPath: `/${key}`,
    schemaPath: `/properties/${key}/constraint`
  }];

  throw err;
};
