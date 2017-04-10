import { Action, Params } from "../action";
import { Filter } from "../filter";
import { Source } from "../source";
import { Resource, initialize } from "../resource";
import { Item } from "../types";
import { Schema } from "../schema";
import * as query from "../query";
import { Document, Embed, Link } from "../Document";
import { Root } from "./Root";
import { ReadCollection } from "./ReadCollection";
import { CreateItem } from "./CreateItem";

import * as uriTpl from "uri-templates";
import { Request } from "hapi";
import { is, evolve, pathEq, prepend } from "ramda";

export class ReadItem implements Action {
  path: string;

  method = "GET";

  readonly resource = initialize(this._resource);

  constructor(protected _resource: Partial<Resource>) {
    let keys = this.resource.primaryKeys.map(key => `{${key}}`);
    this.path = [this.resource.name, ...keys].join("/");
  }

  handle = async (params: Params, request: Request): Promise<Item> => {
    let query = await this.query(params, request);
    return this.resource.source.read<Item>(query);
  }

  query = async (params: Params, request: Request): Promise<query.Read> =>
    Promise.all([
      this.schema(params, request),
      this.joins(params, request),
      this.conditions(params, request)
    ]).then(([schema, joins, conditions]) => ({
      return: "item" as "item",
      source: this.resource.name,
      schema,
      joins,
      conditions
    }))

  schema = async (params: Params, request: Request): Promise<Schema> =>
    this.resource.schema;

  conditions = async (params: Params, request: Request): Promise<query.Condition[]> =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
    }))

  joins = async (params: Params, request: Request): Promise<query.Join[]> =>
    this.resource.relationships.belongsTo.map(parent => ({
      source: parent.name,
      path: [this.resource.name, parent.name],
      from: parent.from,
      to: parent.to
    }))

  decorate = async (doc: Document, params: Params, request: Request): Promise<Document> => {
    this.embedded(doc, params, request)
      .filter(embed => Object.keys(embed.document.properties).length > 0)
      .forEach(embed => {
        doc.embedded.push(embed);
        delete doc.properties[embed.rel];
      });

    doc.links.push(...this.links(doc, params, request));

    return doc;
  }

  embedded = (doc: Document, params: Params, request: Request): Embed[] =>
    this.resource.relationships.belongsTo.map(parent => ({
      rel: parent.name,
      document: new Document(doc.properties[parent.name])
    }))

  links = (doc: Document, params: Params, request: Request): Link[] => [];

  omit = (doc: Document, params: Params, request: Request): string[] =>
    this.resource.relationships.belongsTo.map(parent => parent.name);

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
          name: "item"
        });

        return doc;
      }
    },

    <Filter<CreateItem, "handle">>{
      type: CreateItem,
      method: "handle",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (params, request) => {
        let response = await next(params, request);
        let href = uriTpl(this.path).fillFromObject(response.plugins.prism.createdItem);
        response.location(href);
        return response;
      }
    },

    /**
     * Register a link to this action on items that are embedded in a collection
     */
    <Filter<ReadCollection, "embedItem">>{
      type: ReadCollection,
      method: "embedItem",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (item, params, request) => {
        let embed = await next(item, params, request);

        if (embed.rel === this.resource.name) {
          embed.document.links.push({
            rel: "self",
            href: this.path,
            params: embed.document.properties
          });

          await this.decorate(embed.document, params, request);
        }

        return embed;
      }
    },

    /**
     * Recursively embed this resource into child resources as a parent by
     * modifying child join query parameters
     */
    this.resource.relationships.has.map(child => <Filter<ReadItem, "joins">>({
      type: ReadItem,
      method: "joins",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) =>
        Promise.all([
          next(params, request),
          this.joins(params, request)
        ]).then(([childJoins, ownJoins]) => ([
          ...childJoins,
          ...ownJoins.map(evolve({
            path: prepend(child.name)
          }))
        ]))
    })),

    /**
     * Recursively apply links and other decorations defined by this action when
     * a resource has been embedded in child resources as a parent
     */
    this.resource.relationships.has.map(child => <Filter<ReadItem, "decorate">>({
      type: ReadItem,
      method: "decorate",
      where: pathEq(["resource", "name"], child.name),
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        let embeds = doc.embedded
          .filter(embed => embed.document.properties && embed.rel === this.resource.name)
          .map(embed => {
            embed.document.links.push({
              rel: "self",
              href: this.path,
              params: embed.document.properties
            });

            return this.decorate(embed.document, params, request);
          });

        await Promise.all(embeds);

        return doc;
      }
    }))
  ];
}
