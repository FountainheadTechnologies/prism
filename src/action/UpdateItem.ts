import {Action, Params, Filter} from "../action";
import {ReadItem} from "./ReadItem";
import {Root} from "./Root";
import {Resource, initialize} from "../resource";
import {Schema, validate} from "../schema";
import * as query from "../query";

import * as Promise from "bluebird";
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

  handle = (params: Params, request: Request): Promise<Response> => {
    let schema = this.schema(params, request);
    let source = this.resource.source;

    return validate(request.payload, schema)
      .then(() => source.update(this.query(params, request)))
      .then(() => {
        let response = (request as any).generateResponse();
        response.code(204);

        return response;
      });
  }

  schema = (params: Params, request: Request): Schema => ({
    ...this.resource.schema,
    required: []
  })

  query = (params: Params, request: Request): query.Update => ({
    conditions: this.conditions(params, request),
    returning: this.resource.primaryKeys,
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    data:   request.payload
  })

  conditions = (params: Params, request: Request): query.Condition[] =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
    }))

  joins = (params: Params, request: Request): query.Join[] =>
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
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: "update",
          method: this.method,
          schema: this.schema(params, request)
        });

        return doc;
      }
    },

    /**
     * Register a form for this action on item documents
     */
    <Filter<ReadItem, "decorate">>{
      type: ReadItem,
      name: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: "update",
          params: doc.properties,
          method: this.method,
          schema: this.schema(params, request)
        });

        return doc;
      }
    }
  ];
}
