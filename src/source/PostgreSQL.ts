import Source from '../source';
import {Item, Collection} from '../types';
import * as query from '../query';

import {IDatabase} from 'pg-promise';
import * as Promise from 'bluebird';
import * as _squel from 'squel';

import {omit, assocPath, path} from 'ramda';

export interface Options {
  joinMarker: string
}

const squel = _squel.useFlavour('postgres');

const DEFAULT_OPTIONS: Options = {
  joinMarker: 'Δ'
};

export default class PostgreSQL implements Source {
  protected _options: Options;

  constructor(readonly db: IDatabase<{}>, options?: Partial<Options>) {
    this._options = {...DEFAULT_OPTIONS, ...options};
  }

  create<T extends query.Create>(query: T): Promise<Item | Collection> {
    var sql = squel.insert()
      .into(query.source)
      .returning(query.returning.join(','));

    this._withJoins(sql, query);
    sql.setFields(query.data);

    var statement = sql.toParam();

    return this.db.oneOrNone(statement.text, statement.values) as any;
  }

  read<T extends query.Read>(query: T): Promise<Item | Collection> {
    var sql = squel.select()
      .from(query.source);

    this._addFields(sql, query);
    this._addConditions(sql, query);
    this._addJoins(sql, query);
    this._addPages(sql, query);

    if (query.return === 'item') {
      let statement = sql.toParam();

      return Promise.resolve(this.db.oneOrNone(statement.text, statement.values))
        .then(result => this._mergeJoins(result, query));
    }

    this._addPages(sql, query);
    let statement = sql.toParam();

    var count = squel.select()
      .from(query.source)
      .field(`COUNT(*)`);

    this._addConditions(count, query);
    this._addJoins(count, query, true);

    var countStatement = count.toParam();

    return Promise.props({
      items: this.db.manyOrNone(statement.text, statement.values)
        .then(results => results.map(result => this._mergeJoins(result, query))),
      count: this.db.one(countStatement.text, countStatement.values)
        .then(result => parseInt(result.count, 10))
    });
  }

  update<T extends query.Update>(query: T): Promise<Item | Collection> {
    var sql = squel.update()
      .table(query.source)
      .setFields(query.data)
      .returning(query.returning.join(','));

    this._addConditions(sql, query);
    this._withJoins(sql, query);

    var statement = sql.toParam();
    return this.db.oneOrNone(statement.text, statement.values) as any;
  }

  delete<T extends query.Delete>(query: T): Promise<boolean> {
    var sql = squel.delete()
      .from(query.source);

    this._addConditions(sql, query);

    var statement = sql.toParam();
    return this.db.oneOrNone(statement.text, statement.values) as any;
  }

  protected _addPages(sql: SqlSelect, query: query.Read): void {
    if (query.page) {
      sql.limit(query.page.size);
      sql.offset(query.page.size * (query.page.number - 1));
    }
  }

  protected _addFields(sql: SqlSelect, query: query.Read): void {
    if (query.fields) {
      sql.fields(query.fields.map(field => `${query.source}.${field}`));
    } else {
      sql.field(`${query.source}.*`);
    }
  }

  protected _addConditions(sql: SqlSelect | SqlUpdate | SqlDelete, query: query.Read | query.Update | query.Delete): void {
    if (query.conditions) {
      query.conditions.forEach(condition => {
        (sql as any).where(`${query.source}.${condition.field} = ?`, condition.value);
      });
    }
  }

  protected _addJoins(sql: SqlSelect, query: query.Read, counting?: boolean) {
    if (query.joins) {
      query.joins.forEach(join => {
        var alias = join.path.join(this._options.joinMarker);
        var self  = join.path.slice(0, -1).join(this._options.joinMarker);
        sql.join(join.source, alias, `${alias}.${join.to} = ${self}.${join.from}`);

        if (!counting) {
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
      var path = join.path.slice(1);
      var key  = join.path.join(this._options.joinMarker);

      return omit([key], assocPath(path, result[key], result));
    }, result);
  }

  protected _withJoins(sql: SqlUpdate | SqlInsert, query: query.Create | query.Update) {
    if (!query.joins) {
      return;
    }

    query.joins
      .sort(join => join.path.length)
      .forEach(join => {
        var nested = path(join.path, query.data);

        if (typeof nested !== 'object') {
          return;
        }

        var alias = join.path.join(this._options.joinMarker);

        var insert = squel.insert()
          .into(join.source)
          .setFields(nested)
          .returning(join.to);

        sql.with(alias, insert);

        var select = squel.select()
          .from(alias)
          .field(join.to);

        query.data = assocPath(join.path, select, query.data);
      });
  }
}
