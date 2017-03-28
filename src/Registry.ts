import {Action} from "./action";
import {Filter, Type} from "./filter";

import {partition, always, wrap} from "ramda";

export class Registry {
  protected _actions: Action[] = [];
  protected _filters: Filter<Action, any>[] = [];

  registerAction(action: Action): void {
    this._actions.push(action);

    if (action.filters) {
      action.filters.forEach(filter => this.registerFilter(filter));
    }
  }

  findActions<T extends Action>(types: Type<T>[], where?: (action: Action) => boolean) {
    return this._actions
      .filter(action => {
        for (let type in types) {
          if (action instanceof types[type]) {
            return true;
          }
        }
      })
      .filter(action => {
        if (where && where(action) === false) {
          return;
        }

        return true;
      });
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    if (filter instanceof Array) {
      return filter.forEach(filter => this.registerFilter(filter));
    }

    this._filters.push(filter);
  }

  applyFilters(): void {
    this._filters.forEach(filter => {
      let types = filter.type instanceof Array ? filter.type : [filter.type];

      this.findActions(types, filter.where)
        .forEach((action: any) => {
          let wrapper = (next: Function, ...args: any[]) =>
            filter.filter(next, action, this)(...args);

          action[filter.name] = wrap(action[filter.name], wrapper);
        });
    });
  }
}
