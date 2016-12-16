import Action, {Params, Filter} from 'prism/action';
import Resource from 'prism/resource';
import {Collection} from 'prism/types';
import Schema from 'prism/schema';
import * as query from 'prism/query';
import Document, {Link, Embed} from 'prism/document';
import Root from 'prism/action/Root';
import ReadItem from 'prism/action/ReadItem';

import * as Promise from 'bluebird';
import {Request} from 'hapi';
import {toPairs, pathEq, evolve, prepend} from 'ramda';

export interface Options {
  pageSize: number;
}

const DEFAULT_OPTIONS: Options = {
  pageSize: 20
}

export default class ReadCollection implements Action {
  protected _options: Options;

  path: string;

  method = 'GET';

  constructor(readonly resource: Resource, options?: Partial<Options>) {
    this.path = this.resource.name;
    this._options = {...DEFAULT_OPTIONS, ...options};
  }

  handle = (params: Params, request: Request): Promise<Collection> =>
    this.resource.source
    .read<Collection>(this.query(params, request));

  query = (params: Params, request: Request): query.Read => ({
    return: 'collection',
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    conditions: this.conditions(params, request),
    order: this.order(params, request),
    page: this.page(params, request)
  });

  schema = (params: Params, request: Request): Schema =>
    this.resource.schema;

  joins = (params: Params, request: Request): query.Join[] =>
    this.resource.parents.map(parent => ({
      source: parent.name,
      path:   [this.resource.name, parent.name],
      from:   parent.from,
      to:     parent.to
    }));

  conditions = (params: Params, request: Request): query.Condition[] =>
    toPairs<string, string>(params['where'])
      .map(([field, value]) => ({field, value}));

  order = (params: Params, request: Request): query.Order[] =>
    toPairs<string, string>(params['order'])
      .map(([field, direction]) => ({field, direction}));

  page = (params: Params, request: Request): query.Page => ({
    number: params.page ? parseInt(params.page, 10) : 1,
    size:   this._options.pageSize
  });

  decorate = (doc: Document, params: Params, request: Request): Document => {
    doc.embedded.push(...this.embedded(doc, params, request));
    doc.links.push(...this.links(doc, params, request));
    doc.omit.push(...this.omit(doc, params, request));

    return doc;
  }

  embedded = (doc: Document, params: Params, request: Request): Embed[] =>
    (doc.properties['items'] as Array<any>)
      .map(item => this.embedItem(item, params, request));

  embedItem = (item: any, params: Params, request: Request): Embed => {
    var document = new Document(item);

    document.embedded = this.resource.parents.map(parent => ({
      rel: parent.name,
      document: new Document(item[parent.name])
    }));

    document.omit = this.resource.parents.map(parent => parent.name);

    return {
      rel: this.resource.name,
      document
    };
  }

  links = (doc: Document, params: Params, request: Request): Link[] => {
    if (doc.properties['count'] < this._options.pageSize) {
      return [];
    }

    var pages   = [];
    var current = params.page ? parseInt(params.page, 10) : 1;
    var last    = Math.ceil(doc.properties['count'] / this._options.pageSize);

    if (current > 1) {
      pages.push({
        rel: 'first',
        params: {
          page: 1
        }
      }, {
        rel: 'prev',
        params: {
          page: current - 1
        }
      });
    }

    if (current < last) {
      pages.push({
        rel: 'next',
        params: {
          page: current + 1
        }
      }, {
        rel: 'last',
        params: {
          page: last
        }
      });
    }

    return pages;
  }

  omit = (doc: Document, params: Params, request: Request): string[] => ['items']

  filters = [
    /**
     * Register a link to this action in the root document
     */
    <Filter<Root, 'decorate'>>{
      type: Root,
      name: 'decorate',
      filter: next => doc => {
        next(doc);

        doc.links.push({
          rel:  this.resource.name,
          href: this.path,
          name: 'collection'
        });

        return doc;
      }
    },

    /**
     * Recursively embed this resource into child resources as a parent by
     * modifying child join query parameters
     */
    this.resource.children.map(child => <Filter<ReadCollection, 'joins'>>({
      type: ReadCollection,
      name: 'joins',
      where: pathEq(['resource', 'name'], child.name),
      filter: next => (params, request) => {
        var joins = this.joins(params, request)
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
    ...this.resource.parents.map(parent => <Filter<ReadItem, 'decorate'>>({
      type: ReadItem,
      name: 'decorate',
      where: pathEq(['resource', 'name'], parent.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.links.push({
          rel: this.resource.name,
          href: this.path,
          name: 'collection',
          params: {
            where: {
              [parent.from]: doc.properties[parent.to]
            }
          }
        });

        return doc;
      }
    }))
  ]
}
