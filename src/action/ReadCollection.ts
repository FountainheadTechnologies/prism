import {Action, Params, Filter} from "../action";
import {Resource, initialize} from "../resource";
import {Collection} from "../types";
import {Schema} from "../schema";
import * as query from "../query";
import {Document, Link, Embed} from "../Document";
import {Root} from "./Root";
import {ReadItem} from "./ReadItem";

import * as Promise from "bluebird";
import {Request} from "hapi";
import {toPairs, pathEq, evolve, prepend} from "ramda";

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

  readonly resource = initialize(this._resource, {requirePK: false});

  constructor(protected _resource: Partial<Resource>, options?: Partial<Options>) {
    this._options = {...DEFAULT_OPTIONS, ...options};
    this.path = `${this.resource.name}{?where,page,order}`;
  }

  handle = (params: Params, request: Request): Promise<Collection> =>
    this.resource.source
    .read<Collection>(this.query(params, request));

  query = (params: Params, request: Request): query.Read => ({
    return: "collection",
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    conditions: this.conditions(params, request),
    order: this.order(params, request),
    page: this.page(params, request)
  })

  schema = (params: Params, request: Request): Schema =>
    this.resource.schema;

  joins = (params: Params, request: Request): query.Join[] =>
    this.resource.relationships.belongsTo.map(parent => ({
      source: parent.name,
      path:   [this.resource.name, parent.name],
      from:   parent.from,
      to:     parent.to
    }))

  conditions = (params: Params, request: Request): query.Condition[] =>
    toPairs<string, string>(params["where"])
      .map(([field, value]) => ({field, value}));

  order = (params: Params, request: Request): query.Order[] =>
    toPairs<string, string>(params["order"])
      .map(([field, direction]) => ({field, direction}));

  page = (params: Params, request: Request): query.Page => ({
    number: params.page ? parseInt(params.page, 10) : 1,
    size:   this._options.pageSize
  })

  decorate = (doc: Document, params: Params, request: Request): Document => {
    doc.embedded.push(...this.embedded(doc, params, request));
    doc.links.push(...this.links(doc, params, request));

    delete doc.properties["items"];

    return doc;
  }

  embedded = (doc: Document, params: Params, request: Request): Embed[] =>
    (doc.properties["items"] as Array<any>)
      .map(item => this.embedItem(item, params, request));

  embedItem = (item: any, params: Params, request: Request): Embed => {
    let document = new Document(item);

    this.resource.relationships.belongsTo.forEach(parent => {
      document.embedded.push({
        rel: parent.name,
        document: new Document(document.properties[parent.name])
      });

      delete document.properties[parent.name];
    });

    return {
      rel: this.resource.name,
      alwaysArray: true,
      document
    };
  }

  links = (doc: Document, params: Params, request: Request): Link[] => {
    if (doc.properties["count"] < this._options.pageSize) {
      return [];
    }

    let pages   = [];
    let current = params.page ? parseInt(params.page, 10) : 1;
    let last    = Math.ceil(doc.properties["count"] / this._options.pageSize);

    if (current > 1) {
      pages.push({
        rel: "first",
        href: this.path,
        params: {
          page: 1
        }
      }, {
        rel: "prev",
        href: this.path,
        params: {
          page: current - 1
        }
      });
    }

    if (current < last) {
      pages.push({
        rel: "next",
        href: this.path,
        params: {
          page: current + 1
        }
      }, {
        rel: "last",
        href: this.path,
        params: {
          page: last
        }
      });
    }

    return pages;
  }

  omit = (doc: Document, params: Params, request: Request): string[] => ["items"];

  filters = [
    /**
     * Register a link to this action in the root document
     */
    <Filter<Root, "decorate">>{
      type: Root,
      name: "decorate",
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.links.push({
          rel:  this.resource.name,
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
      name: "joins",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) => {
        let joins = this.joins(params, request)
          .map(evolve({
            path: prepend(child.name)
          }));

        return next(params, request)
          .concat(joins as any as query.Join[]);
      }
    })),

    /**
     * Register a link to this action from parent ItemRead documents
     */
    ...this.resource.relationships.belongsTo.map(parent => <Filter<ReadItem, "decorate">>({
      type: ReadItem,
      name: "decorate",
      where: pathEq(["resource", "name"], parent.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

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
