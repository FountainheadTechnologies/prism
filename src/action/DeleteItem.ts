import { Action, Params } from "../action";
import { Filter } from "../filter";
import { ReadItem } from "./ReadItem";
import { Root } from "./Root";
import { Resource } from "../resource";
import * as query from "../query";

import { Request, ResponseObject } from "hapi";
import { pathEq } from "ramda";

export class DeleteItem implements Action {
  path: string;

  method = "DELETE";

  constructor(readonly resource: Resource) {
    let keys = this.resource.primaryKeys.map(key => `{${key}}`);
    this.path = [this.resource.name, ...keys].join("/");
  }

  handle = async (params: Params, request: Request): Promise<ResponseObject> => {
    let query = await this.query(params, request);
    await this.deleteItem(query, params, request);

    let response = request.generateResponse(null);
    response.code(204);

    return response;
  }

  query = async (params: Params, request: Request): Promise<query.Delete> => ({
    conditions: await this.conditions(params, request),
    source: this.resource.name
  })

  conditions = async (params: Params, request: Request): Promise<query.Condition[]> =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
    }))

  deleteItem = async (query: query.Delete, params: Params, request: Request): Promise<boolean> =>
    this.resource.source.delete(query)

  register = this.resource.source;

  filters = [
    /**
     * Register a form for this action in the root document
     */
    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: "delete",
          method: this.method
        });

        return doc;
      }
    },

    /**
     * Register a form for this action on item documents
     */
    <Filter<ReadItem, "decorate">>{
      type: ReadItem,
      method: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        doc.forms.push({
          rel: "self",
          href: this.path,
          name: "delete",
          params: doc.properties,
          method: this.method
        });

        return doc;
      }
    }
  ];
}
