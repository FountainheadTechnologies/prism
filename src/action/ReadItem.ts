import Action, {Params, Filter} from 'prism/action';
import Resource from 'prism/resource';
import {Item} from 'prism/types';
import Schema from 'prism/schema';
import * as query from 'prism/query';
import Document, {Embed, Link} from 'prism/document';
import Root from 'prism/action/Root';
import ReadCollection from 'prism/action/ReadCollection';

import * as Promise from 'bluebird';
import {Request} from 'hapi';
import {is, evolve, pathEq, prepend} from 'ramda';

export default class ReadItem implements Action {
  path: string;

  method = 'GET';

  constructor(readonly resource: Resource) {
    var keys = this.resource.primaryKeys.map(key => `{${key}}`);
    this.path = [this.resource.name, ...keys].join('/');
  }

  handle = (params: Params, request: Request): Promise<Item> =>
    this.resource.source
      .read<Item>(this.query(params, request));

  query = (params: Params, request: Request): query.Read => ({
    return: 'item',
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    conditions: this.conditions(params, request)
  });

  schema = (params: Params, request: Request): Schema =>
    this.resource.schema;

  conditions = (params: Params, request: Request): query.Condition[] =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
    }));

  joins = (params: Params, request: Request): query.Join[] =>
    this.resource.parents.map(parent => ({
      source: parent.name,
      path:   [this.resource.name, parent.name],
      from:   parent.from,
      to:     parent.to
    }));

  decorate = (doc: Document, params: Params, request: Request): Document => {
    doc.embedded.push(...this.embedded(doc, params, request));
    doc.links.push(...this.links(doc, params, request));
    doc.omit.push(...this.omit(doc, params, request));

    return doc;
  }

  embedded = (doc: Document, params: Params, request: Request): Embed[] =>
    this.resource.parents.map(parent => ({
      rel: parent.name,
      document: new Document(doc.properties[parent.name])
    }));

  links = (doc: Document, params: Params, request: Request): Link[] => []

  omit = (doc: Document, params: Params, request: Request): string[] =>
    this.resource.parents.map(parent => parent.name);

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
          href: this.path
        });

        return doc;
      }
    },

    /**
     * Register a link to this action on items that are embedded in a collection
     */
    <Filter<ReadCollection, 'embedItem'>>{
      type: ReadCollection,
      name: 'embedItem',
      where: pathEq(['resource', 'name'], this.resource.name),
      filter: next => (item, params, request) => {
        var embed = next(item, params, request);

        if (embed.rel === this.resource.name) {
          embed.document.links.push({
            rel:    'self',
            href:   this.path,
            params: embed.document.properties
          });
        }

        return embed;
      }
    },

    /**
     * Recursively embed this resource into child resources as a parent by
     * modifying child join query parameters
     */
    this.resource.children.map(child => <Filter<ReadItem, 'joins'>>({
      type: ReadItem,
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
     * Recursively apply links and other decorations defined by this action when
     * a resource has been embedded in child resources as a parent
     */
    this.resource.children.map(child => <Filter<ReadItem, 'decorate'>>({
      type:  ReadItem,
      name: 'decorate',
      where: pathEq(['resource', 'name'], child.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.embedded
          .filter(embed => embed.document.properties && embed.rel === this.resource.name)
          .forEach(embed => {
            embed.document.links.push({
              rel:    'self',
              href:   this.path,
              params: embed.document.properties
            });

            this.decorate(embed.document, params, request);
          });

        return doc;
      }
    }))
  ]
}
