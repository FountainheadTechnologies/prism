import {Action, Params} from "../action";
import {Filter} from "../filter";
import {ReadItem} from "./ReadItem";
import {Root} from "./Root";
import {Resource, initialize} from "../resource";
import {Schema, validate} from "../schema";
import * as query from "../query";

import {Request, Response} from "hapi";
import {pathEq} from "ramda";

export class UpdateItem implements Action {
  path: string;

  method = "PATCH";

  readonly resource = initialize(this._resource);

  constructor(protected _resource: Partial<Resource>) {
    let keys = this.resource.primaryKeys.map(key => `{${key}}`);
    this.path = [this.resource.name, ...keys].join("/");
  }

  handle = async (params: Params, request: Request): Promise<Response> => {
    let schema = await this.schema(params, request);
    await validate(request.payload, schema);

    let query = await this.query(params, request);
    await this.resource.source.update(query);

    let response = (request as any).generateResponse();
    response.code(204);

    return response;
  }

  schema = async (params: Params, request: Request): Promise<Schema> => ({
    ...this.resource.schema,
    required: []
  })

  query = async (params: Params, request: Request): Promise<query.Update> =>
    Promise.all([
      this.conditions(params, request),
      this.schema(params, request),
      this.joins(params, request)
    ]).then(([conditions, schema, joins]) => ({
      returning: this.resource.primaryKeys,
      source: this.resource.name,
      data: request.payload,
      conditions,
      schema,
      joins
    }))

  conditions = async (params: Params, request: Request): Promise<query.Condition[]> =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
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
      name: "decorate",
      filter: next => async (doc, params, request) =>
        Promise.all([
          next(doc, params, request),
          this.schema(params, request)
        ]).then(([doc, schema]) => {
          doc.forms.push({
            rel: this.resource.name,
            href: this.path,
            name: "update",
            method: this.method,
            schema
          });

          return doc;
        })
    },

    /**
     * Register a form for this action on item documents
     */
    <Filter<ReadItem, "decorate">>{
      type: ReadItem,
      name: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (doc, params, request) =>
        Promise.all([
          next(doc, params, request),
          this.schema(params, request)
        ]).then(([doc, schema]) => {
          doc.forms.push({
            rel: this.resource.name,
            href: this.path,
            name: "update",
            params: doc.properties,
            method: this.method,
            schema: {
              ...schema,
            default: doc.properties
            }
          });

          return doc;
        })
    }
  ];
}
