import { Registry } from "./Registry";

export interface Type<T> {
  new (...args: any[]): T;
}

export interface Filter<T, K extends keyof T> {
  type: Type<T> | Type<T>[];
  method: K;
  where?: (action: T) => boolean;
  filter: (next: T[K], self: T, registry: Registry) => T[K];
}

export interface Container {
  filters?: Array<Filter<any, any> | Array<Filter<any, any>>>;
  register?: any | any[];
}
