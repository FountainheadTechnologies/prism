import {Resource} from "./resource";
import {Document} from "./Document";
import {Registry} from "./Registry";

import {
  Request,
  IRouteAdditionalConfigurationOptions
} from "hapi";

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

export interface Action {
  readonly method: string;

  routeConfig?: IRouteAdditionalConfigurationOptions;

  path: string;

  handle: (params: Params, request?: Request) => any;

  decorate?: (doc: Document, params?: Params, request?: Request) => Document;

  filters?: Array<Filter<Action, any> | Array<Filter<Action, any>>>;
}

export interface Type<T> {
  new (...args: any[]): T;
}

export interface Filter<T, K extends keyof T> {
  type: Type<T> | Type<T>[];
  name: K;
  where?: (action: T) => boolean;
  filter: (next: T[K], self: T, registry: Registry) => T[K];
}

export {ReadItem} from "./action/ReadItem";
export {ReadCollection} from "./action/ReadCollection";
export {CreateItem} from "./action/CreateItem";
export {UpdateItem} from "./action/UpdateItem";
export {DeleteItem} from "./action/DeleteItem";
