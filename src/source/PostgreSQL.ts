import { Source } from "../source";
import { Item, Collection } from "../types";
import * as query from "../query";

import { IDatabase } from "pg-promise";
import { badData } from "boom";
import * as _squel from "squel";
import { notFound } from "boom";

import { omit, assocPath, path, identity, map } from "ramda";

export interface Options {
  joinMarker: string;
}

const squel = (_squel as any).useFlavour("postgres");

// Allow Arrays to be passed straight through and let pgPromise to handle type conversion
(squel as any).registerValueHandler(Array, identity);

const DEFAULT_OPTIONS: Options = {
  joinMarker: "Δ"
};

export class PostgreSQL implements Source {
  protected _options: Options;

  constructor(readonly db: IDatabase<{}>, options?: Partial<Options>) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  create<T extends query.Create>(query: T): Promise<Item | Collection> {
    let sql = squel.insert()
      .into(query.source)
      .returning(query.returning.join(","));

    this._withJoins(sql, query);
    this._setValues(sql, query.data);

    let statement = sql.toParam();

    return this.db.oneOrNone(statement.text, statement.values)
      .catch(handleConstraintViolation) as any;
  }

  async read<T extends query.Read>(query: T): Promise<Item | Collection> {
    let itemQuery = squel.select()
      .from(query.source);

    this._addFields(itemQuery, query);
    this._addConditions(itemQuery, query);
    this._addOrder(itemQuery, query);
    this._addJoins(itemQuery, query);
    this._addPages(itemQuery, query);

    if (query.return === "item") {
      let statement = itemQuery.toParam();

      let result = await this.db.oneOrNone(statement.text, statement.values);
      if (result === null) {
        throw notFound();
      }

      return this._mergeJoins(result, query);
    }

    this._addPages(itemQuery, query);
    let itemStatement = itemQuery.toParam();

    let countQuery = squel.select()
      .from(query.source)
      .field(`COUNT(*)`);

    this._addConditions(countQuery, query);
    this._addJoins(countQuery, query, true);

    let countStatement = countQuery.toParam();

    let items = this.db.manyOrNone(itemStatement.text, itemStatement.values)
      .then(results => results.map(
        result => this._mergeJoins(result, query)
      ));

    let count = this.db.one(countStatement.text, countStatement.values)
      .then(result => parseInt(result.count, 10));

    return Promise
      .all([items, count])
      .then(([items, count]) => ({ items, count }));
  }

  update<T extends query.Update>(query: T): Promise<Item | Collection> {
    let sql = squel.update()
      .table(query.source)
      .returning(query.returning.join(","));

    this._addConditions(sql, query);
    this._withJoins(sql, query);
    this._setValues(sql, query.data);

    let statement = sql.toParam();

    return this.db.oneOrNone(statement.text, statement.values)
      .catch(handleConstraintViolation) as any;
  }

  delete<T extends query.Delete>(query: T): Promise<boolean> {
    let sql = squel.delete()
      .from(query.source);

    this._addConditions(sql, query);

    let statement = sql.toParam();
    return this.db.result(statement.text, statement.values)
      .then(result => {
        if (result.rowCount === 0) {
          throw notFound();
        }

        return true;
      }) as any;
  }

  protected _addPages(sql: SqlSelect, query: query.Read): void {
    if (query.page) {
      sql.limit(query.page.size);
      sql.offset(query.page.size * (query.page.number - 1));
    }
  }

  protected _addFields(sql: SqlSelect, query: query.Read): void {
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

  protected _addConditions(sql: SqlSelect | SqlUpdate | SqlDelete, query: query.Read | query.Update | query.Delete): void {
    const applyExpression = (target: any, method: "where" | "and" | "or", expression: Expression | [string, any]) => {
      if (expression instanceof Array) {
        target[method](expression[0], expression[1]);
        return;
      }

      target[method](expression);
    };

    const buildExpression = (condition: query.Condition): Expression | [string, any] => {
      let expr = (squel as any).expr() as Expression;

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
      return [
        `${query.source}.${condition.field} ${operator} ?`,
        condition.value
      ];
    };

    if (query.conditions) {
      query.conditions.forEach(condition => {
        applyExpression(sql, "where", buildExpression(condition));
      });
    }
  };

  protected _addOrder(sql: SqlSelect, query: query.Read): void {
    if (query.order) {
      query.order.forEach(order => {
        sql.order(order.field, order.direction.toLowerCase() === "asc");
      });
    }
  }

  protected _addJoins(sql: SqlSelect, query: query.Read, counting?: boolean) {
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

  protected _withJoins(sql: SqlUpdate | SqlInsert, query: query.Create | query.Update) {
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

        sql.with(alias, insert);

        let select = squel.select()
          .from(alias)
          .field(join.to);

        query.data = assocPath(join.path, select, query.data);
      });
  }

  protected _setValues(sql: SqlUpdate | SqlInsert, data: any) {
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
  err.output.payload.errors = [{
    message: "Constraint violation",
    dataPath: `/${key}`,
    schemaPath: `/properties/${key}/constraint`
  }];

  throw err;
};
