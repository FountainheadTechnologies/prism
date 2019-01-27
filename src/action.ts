import { Document } from "./Document";
import { Container } from "./filter";

import { Request, ServerRoute, ResponseObject } from "hapi";

export interface Params {
  where?: {
    [key: string]: string;
  };

  order?: {
    [key: string]: string;
  };

  page?: string;

  [key: string]: any;
}

export interface Action extends Container {
  readonly method: ServerRoute["method"];

  routeOptions?: ServerRoute["options"];

  path: string;

  handle: (params: Params, request: Request) => Promise<ResponseObject | {}>;

  decorate?: (doc: Document, params: Params, request: Request) => Promise<Document>;
}

export { Root } from "./action/Root";
export { ReadItem } from "./action/ReadItem";
export { ReadCollection } from "./action/ReadCollection";
export { CreateItem } from "./action/CreateItem";
export { UpdateItem } from "./action/UpdateItem";
export { DeleteItem } from "./action/DeleteItem";
