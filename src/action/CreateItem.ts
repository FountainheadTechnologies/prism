import Action, {Params, Filter} from "../action";
import ReadCollection from "./ReadCollection";
import Root from "./Root";
import Resource from "../resource";
import {Item} from "../types";
import Schema, {validate, sanitize} from "../schema";
import * as query from "../query";

import * as Promise from "bluebird";
import {Request, Response} from "hapi";
import {evolve, prepend, pathEq} from "ramda";

export default class CreateItem implements Action {
  path: string;

  method = "POST";

  constructor(readonly resource: Resource) {
    this.path = this.resource.name;
  }

  handle = (params: Params, request: Request): Promise<Response> => {
    let schema = this.schema(params, request);
    let source = this.resource.source;

    return validate(request.payload, schema)
      .then(() => source.create(this.query(params, request)))
      .then(createdItem => {
        let response = (request as any).generateResponse();
        response.code(201);
        response.plugins.prism = {createdItem};

        return response;
      });
  }

  schema = (params: Params, request: Request): Schema =>
    this.resource.schema;

  query = (params: Params, request: Request): query.Create => ({
    returning: this.resource.primaryKeys,
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    data:   request.payload
  })

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
          name: "create",
          method: this.method,
          schema: this.schema(params, request)
        });

        return doc;
      }
    },

    /**
     * Register a form for this action on ReadCollection documents
     */
    <Filter<ReadCollection, "decorate">>{
      type: ReadCollection,
      name: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: "create",
          method: this.method,
          schema: this.schema(params, request)
        });

        return doc;
      }
    },

    /**
     * Allow embedded objects to be recursively created on child resources by
     * modifying child join query parameters
     */
    this.resource.relationships.has.map(child => <Filter<CreateItem, "joins">>({
      type: CreateItem,
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
     * Add this schema as an alternative value for the Create form on child
     * resources
     */
    this.resource.relationships.has.map(child => <Filter<CreateItem, "schema">>({
      type: CreateItem,
      name: "schema",
      where: pathEq(["resource", "name"], child.name),
      filter: next => (params, request) => {
        let schema = next(params, request);
        let prop   = schema.properties[child.to];

        if (!prop.oneOf) {
          schema.properties[child.to] = {
            oneOf: [
              prop,
              this.schema(params, request)
            ]
          };
        }

        return schema;
      }
    })),
  ];
}
