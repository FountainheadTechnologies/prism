import Source from 'prism/source';
import {Item, Collection} from 'prism/types';
import * as query from 'prism/query';

import {IDatabase} from 'pg-promise';
import * as Promise from 'bluebird';
import * as _knex from 'knex';

const knex = _knex({client: 'pg'});

import {omit, assocPath, path} from 'ramda';

export interface Options {
  joinMarker: string
}

const DEFAULT_OPTIONS: Options = {
  joinMarker: 'Δ'
};

export default class PostgreSQL implements Source {
  protected _options: Options;

  constructor(protected _db: IDatabase<{}>, options?: Partial<Options>) {
    this._options = {...DEFAULT_OPTIONS, ...options};
  }

  create<T extends query.Create>(query: T): Promise<Item | Collection> {
    var sql = knex(query.source)
      .insert(query.data)
      .returning(query.returning);

    this._withJoins(sql, query);

    var statement = sql.toSQL();

    return this._db.oneOrNone(statement.sql, statement.bindings) as any;
  }

  read<T extends query.Read>(query: T): Promise<Item | Collection> {
    var sql = knex(query.source);
    this._addFields(sql, query);
    this._addConditions(sql, query);
    this._addJoins(sql, query);
    this._addPages(sql, query);

    if (query.return === 'item') {
      let statement = sql.toSQL();

      return Promise.resolve(this._db.oneOrNone(statement.sql, statement.bindings))
        .then(result => this._mergeJoins(result, query));
    }

    this._addPages(sql, query);
    let statement = sql.toSQL();

    var count = knex(query.source).count();
    this._addConditions(count, query);
    this._addJoins(count, query, true);
    var countStatement = count.toSQL();

    return Promise.props({
      items: this._db.manyOrNone(statement.sql, statement.bindings)
        .then(results => results.map(result => this._mergeJoins(result, query))),
      count: this._db.one(countStatement.sql, countStatement.bindings)
        .then(result => parseInt(result.count, 10))
    });
  }

  update<T extends query.Update>(query: T): Promise<Item | Collection> {
    var sql = knex(query.source)
      .update(query.data)
      .returning(query.returning);

    this._addConditions(sql, query);
    this._withJoins(sql, query);

    var statement = sql.toSQL();
    return this._db.oneOrNone(statement.sql, statement.bindings) as any;
  }

  delete<T extends query.Delete>(query: T): Promise<boolean> {
    var sql = knex(query.source)
      .delete()

    this._addConditions(sql, query);

    var statement = sql.toSQL();
    return this._db.oneOrNone(statement.sql, statement.bindings) as any;
  }

  protected _addPages(sql: _knex.QueryBuilder, query: query.Read): void {
    if (query.page) {
      sql.limit(query.page.size);
      sql.offset(query.page.size * query.page.number);
    }
  }
  protected _addFields(sql: _knex.QueryBuilder, query: query.Read): void {
    if (query.fields) {
      sql.select(...query.fields.map(field => `${query.source}.${field}`));
    } else {
      sql.select(`${query.source}.*`);
    }
  }

  protected _addConditions(sql: _knex.QueryBuilder, query: query.Read | query.Update | query.Delete): void {
    if (query.conditions) {
      query.conditions.forEach(({field, value}) => {
        sql.where(field, value);
      });
    }
  }

  protected _addJoins(sql: _knex.QueryBuilder, query: query.Read, counting?: boolean) {
    if (query.joins) {
      query.joins.forEach(join => {
        var alias = join.path.join(this._options.joinMarker);
        var self  = join.path.slice(0, -1).join(this._options.joinMarker);
        sql.join(`${join.source} as ${alias}`, `${alias}.${join.to}`, `${self}.${join.from}`);

        if (!counting) {
          sql.column(knex.raw(`row_to_json("${alias}".*) as "${alias}"`));
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

  protected _withJoins(sql: _knex.QueryBuilder, query: query.Create | query.Update) {
    if (!query.joins) {
      return;
    }

    query.joins
      .sort(join => join.path.length)
      .forEach(join => {
        var alias  = join.path.join(this._options.joinMarker);
        var nested = path(join.path, query.data);

        if (typeof nested !== 'object') {
          return;
        }

        var insert = knex(join.source)
          .insert(nested)
          .returning(join.to);

        var select = knex(alias)
          .select(join.to);

        query.data = assocPath(join.path, select, query.data);
        console.log(query.data);

        (sql as any).with(alias, (q: any) => {
          q.insert(nested).into(join.source).returning(join.to);
        });
      })
  }
}
