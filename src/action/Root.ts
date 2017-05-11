import { Action, Params } from "../action";
import { Document } from "../Document";

import { Request } from "hapi";

export class Root implements Action {
  path = "";

  method = "GET";

  routeConfig = {};

  handle = async (params: Params, request: Request) => ({});

  decorate = async (doc: Document, params: Params, request: Request): Promise<Document> =>
    doc;
}
