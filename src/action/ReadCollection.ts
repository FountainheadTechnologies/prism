import { Action, Params } from "../action";
import { Filter } from "../filter";
import { Source } from "../source";
import { Resource, initialize } from "../resource";
import { Collection } from "../types";
import { Schema } from "../schema";
import * as query from "../query";
import { Document, Link, Embed } from "../Document";
import { Root } from "./Root";
import { ReadItem } from "./ReadItem";

import { Request } from "hapi";
import { toPairs, pathEq, evolve, prepend } from "ramda";

export interface Options {
  pageSize: number;
}

const DEFAULT_OPTIONS: Options = {
  pageSize: 20
};

export class ReadCollection implements Action {
  protected _options: Options;

  path: string;

  method = "GET";

  readonly resource = initialize(this._resource, { requirePK: false });

  constructor(protected _resource: Partial<Resource>, options?: Partial<Options>) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this.path = `${this.resource.name}{?where,page,order}`;
  }

  handle = async (params: Params, request: Request): Promise<Collection> => {
    let query = await this.query(params, request);
    return this.readCollection(query, params, request);
  }

  query = async (params: Params, request: Request): Promise<query.Read> =>
    Promise.all([
      this.schema(params, request),
      this.joins(params, request),
      this.conditions(params, request),
      this.order(params, request),
      this.page(params, request)
    ]).then(([schema, joins, conditions, order, page]) => ({
      return: "collection" as "collection",
      source: this.resource.name,
      schema,
      joins,
      conditions,
      order,
      page
    } as query.Read))

  schema = async (params: Params, request: Request): Promise<Schema> =>
    this.resource.schema;

  joins = async (params: Params, request: Request): Promise<query.Join[]> =>
    this.resource.relationships.belongsTo.map(parent => ({
      source: parent.name,
      path: [this.resource.name, parent.name],
      from: parent.from,
      to: parent.to
    }))

  conditions = async (params: Params, request: Request): Promise<query.Condition[]> =>
    toPairs<string, string>(params["where"])
      .map(([field, value]) => ({ field, value }));

  order = async (params: Params, request: Request): Promise<query.Order[]> => {
    if (!params["order"]) {
      return this.resource.primaryKeys.map(field => ({
        field,
        direction: "asc"
      }));
    }

    return toPairs<string, string>(params["order"])
      .map(([field, direction]) => ({ field, direction }));
  }

  page = async (params: Params, request: Request): Promise<query.Page> => ({
    number: params.page ? parseInt(params.page, 10) : 1,
    size: this._options.pageSize
  })

  readCollection = async (query: query.Read, params: Params, request: Request): Promise<Collection> =>
    this.resource.source.read<Collection>(query);

  decorate = async (doc: Document, params: Params, request: Request): Promise<Document> => {
    let embedded = await this.embedded(doc, params, request);
    doc.embedded.push(...embedded);

    let links = await this.links(doc, params, request);
    doc.links.push(...links);

    delete doc.properties["items"];

    return doc;
  }

  embedded = async (doc: Document, params: Params, request: Request): Promise<Embed[]> => {
    let embedItems = (doc.properties["items"] as Array<any>)
      .map(item => this.embedItem(item, params, request));

    return Promise.all(embedItems);
  }

  embedItem = async (item: any, params: Params, request: Request): Promise<Embed> => {
    let document = new Document(item);

    this.resource.relationships.belongsTo.forEach(parent => {
      const embedded = document.properties[parent.name];
      delete document.properties[parent.name];

      if (!embedded) {
        return;
      }

      document.embedded.push({
        rel: parent.name,
        document: new Document(embedded)
      });
    });

    return {
      rel: this.resource.name,
      alwaysArray: true,
      document
    };
  }

  links = async (doc: Document, params: Params, request: Request): Promise<Link[]> => {
    if (doc.properties["count"] < this._options.pageSize) {
      return [];
    }

    let pages = [];
    let current = params.page ? parseInt(params.page, 10) : 1;
    let last = Math.ceil(doc.properties["count"] / this._options.pageSize);

    if (current > 1) {
      pages.push({
        rel: "first",
        href: this.path,
        public: true,
        params: {
          ...params,
          page: 1
        }
      }, {
          rel: "prev",
          href: this.path,
          public: true,
          params: {
            ...params,
            page: current - 1
          }
        });
    }

    if (current < last) {
      pages.push({
        rel: "next",
        href: this.path,
        public: true,
        params: {
          ...params,
          page: current + 1
        }
      }, {
          rel: "last",
          href: this.path,
          public: true,
          params: {
            ...params,
            page: last
          }
        });
    }

    return pages;
  }

  omit = (doc: Document, params: Params, request: Request): string[] => ["items"];

  register = this.resource.source;

  filters = [
    /**
     * Register a link to this action in the root document
     */
    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        doc.links.push({
          rel: this.resource.name,
          href: this.path,
          name: "collection"
        });

        return doc;
      }
    },

    /**
     * Recursively embed this resource into child resources as a parent by
     * modifying child join query parameters
     */
    this.resource.relationships.has.map(child => <Filter<ReadCollection, "joins">>({
      type: ReadCollection,
      method: "joins",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) =>
        Promise.all([
          next(params, request),
          this.joins(params, request),
        ]).then(([childJoins, ownJoins]) => ([
          ...childJoins,
          ...ownJoins.map(evolve({
            path: prepend(child.name)
          }))
        ]))
    })),

    /**
     * Register a link to this action from parent ItemRead documents
     */
    ...this.resource.relationships.belongsTo.map(parent => <Filter<ReadItem, "decorate">>({
      type: ReadItem,
      method: "decorate",
      where: pathEq(["resource", "name"], parent.name),
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        doc.links.push({
          rel: this.resource.name,
          href: this.path,
          name: "collection",
          params: {
            where: {
              [parent.from]: doc.properties[parent.to]
            }
          }
        });

        return doc;
      }
    }))
  ];
}
