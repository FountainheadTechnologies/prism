import {Action, Params} from "../action";
import {Document} from "../Document";

import {Request} from "hapi";

export class Root implements Action {
  path = "";

  method = "GET";

  routeConfig = {};

  handle = () => ({});

  decorate = (doc: Document, params: Params, request: Request): Document =>
    doc;
}
