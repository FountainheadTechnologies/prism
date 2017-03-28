import {Action} from "./action";
import {Filter, Type, Container} from "./filter";

import {partition, always, wrap} from "ramda";

export interface FindOptions<T extends any> {
  types: Type<T>[],
  where?: (object: T) => boolean
}

export class Registry {
  protected _registeredObjects: any[] = [];
  protected _filters: Filter<any, any>[] = [];

  registerObject(object: any): void {
    if (this._registeredObjects.indexOf(object) > -1) {
      return;
    }

    this._registeredObjects.push(object);
  }

  findObjects<T extends any>(types: Array<Type<T>>, where?: (object: T) => boolean): T[] {
    return this._registeredObjects
      .filter(object => {
        for (let type in types) {
          if (!(object instanceof types[type])) {
            return false;
          }
        }

        if (!where) {
          return true;
        }

        return where(object);
      })
  }

  registerFilter(filter: Filter<any, any> | Array<Filter<any, any>>): void {
    if (filter instanceof Array) {
      return filter.forEach(filter => this.registerFilter(filter));
    }

    if (this._filters.indexOf(filter) > -1) {
      return;
    }

    this._filters.push(filter);
  }

  applyFilters(): void {
    this._filters.forEach(filter => {
      let types = filter.type instanceof Array ? filter.type : [filter.type];

      this.findObjects(types, filter.where)
        .forEach(object => {
          let wrapper = (next: Function, ...args: any[]) =>
            filter.filter(next, object, this)(...args);

          object[filter.method] = wrap(object[filter.method], wrapper);
        });
    });
  }
}
