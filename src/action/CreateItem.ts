import {Action, Params} from "../action";
import {Filter} from "../filter";
import {ReadCollection} from "./ReadCollection";
import {UpdateItem} from "./UpdateItem";
import {ReadItem} from "./ReadItem";
import {Root} from "./Root";
import {Resource, initialize} from "../resource";
import {Item} from "../types";
import {Schema, validate, sanitize} from "../schema";
import * as query from "../query";

import {Request, Response} from "hapi";
import {evolve, prepend, pathEq} from "ramda";

export class CreateItem implements Action {
  path: string;

  method = "POST";

  readonly resource = initialize(this._resource);

  constructor(protected _resource: Partial<Resource>) {
    this.path = this.resource.name;
  }

  handle = async (params: Params, request: Request): Promise<Response> => {
    let schema = await this.schema(params, request);
    await validate(request.payload, schema);

    let query = await this.query(params, request);
    let createdItem = await this.resource.source.create(query);

    let response = (request as any).generateResponse();
    response.code(201);
    response.plugins.prism = {createdItem};

    return response;
  }

  schema = async (params: Params, request: Request): Promise<Schema> =>
    this.resource.schema;

  query = async (params: Params, request: Request): Promise<query.Create> =>
    Promise.all([
      this.schema(params, request),
      this.joins(params, request)
    ]).then(([schema, joins]) => ({
      returning: this.resource.primaryKeys,
      source: this.resource.name,
      data: request.payload,
      schema,
      joins
    }))

  joins = async (params: Params, request: Request): Promise<query.Join[]> =>
    this.resource.relationships.belongsTo.map(parent => ({
      source: parent.name,
      path:   [parent.from],
      from:   parent.from,
      to:     parent.to
    }))

  filters = [
    /**
     * Register a form for this action in the root document
     */
    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: next => (doc, params, request) =>
        Promise.all([
          next(doc, params, request),
          this.schema(params, request)
        ]).then(([doc, schema]) => {
          doc.forms.push({
            rel: this.resource.name,
            href: this.path,
            name: "create",
            method: this.method,
            schema,
          });

          return doc;
        })
    },

    /**
     * Register a form for this action on ReadCollection documents
     */
    <Filter<ReadCollection, "decorate">>{
      type: ReadCollection,
      method: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => (doc, params, request) =>
        Promise.all([
          next(doc, params, request),
          this.schema(params, request)
        ]).then(([doc, schema]) => {
          doc.forms.push({
            rel: this.resource.name,
            href: this.path,
            name: "create",
            method: this.method,
            schema
          });

          return doc;
        })
    },

    /**
     * Register a form for this action on parent ReadItem documents, with
     * foreign keys pre-populated in `schema.default`
     */
    this.resource.relationships.belongsTo.map(parent => <Filter<ReadItem, "decorate">>({
      type: ReadItem,
      method: "decorate",
      where: pathEq(["resource", "name"], parent.name),
      filter: next => (doc, params, request) =>
        Promise.all([
          next(doc, params, request),
          this.schema(params, request)
        ]).then(([doc, schema]) => {
          doc.forms.push({
            rel: this.resource.name,
            href: this.path,
            name: "create",
            method: this.method,
            schema: {
              ...schema,
              default: {
                ...schema.default,
                [parent.from]: doc.properties[parent.to]
              }
            }
          });

          return doc;
        })
    })),

    /**
     * Allow embedded objects to be recursively created on child resources by
     * modifying child join query parameters
     */
    this.resource.relationships.has.map(child => <Filter<CreateItem, "joins">>({
      type: [CreateItem, UpdateItem],
      method: "joins",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) =>
        Promise.all([
          next(params, request),
          this.joins(params, request)
        ]).then(([childJoins, ownJoins]) => ([
          ...childJoins,
          ...ownJoins.map(evolve({
            path: prepend(child.to)
          }))
        ]))
    })),

    /**
     * Add this schema as an alternative value for the Create form on child
     * resources
     */
    this.resource.relationships.has.map(child => <Filter<CreateItem, "schema">>({
      type: [CreateItem, UpdateItem],
      method: "schema",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) =>
        Promise.all([
          next(params, request),
          this.schema(params, request)
        ]).then(([childSchema, ownSchema]) => {
          let prop = childSchema.properties[child.to];
          if (!prop.oneOf) {
            childSchema.properties[child.to] = {
              oneOf: [
                prop,
                ownSchema
              ]
            };
          }

          return childSchema;
        })
    })),
  ];
}
