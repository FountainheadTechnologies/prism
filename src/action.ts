import Resource from "./resource";
import Document from "./Document";

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

interface Action {
  readonly method: string;

  routeConfig?: IRouteAdditionalConfigurationOptions;

  path: string;

  handle: (params: Params, request?: Request) => any;

  decorate?: (doc: Document, params?: Params, request?: Request) => Document;

  filters?: Array<Filter<any, any> | Array<Filter<any, any>>>;
}

export interface Type<T> {
  new (...args: any[]): T;
}

export interface Filter<T, K extends keyof T> {
  type: Type<T>;
  name: K;
  where?: (action: T) => boolean;
  filter: (next: T[K]) => T[K];
}

export default Action;
