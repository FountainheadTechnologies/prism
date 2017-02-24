import {Action, Filter, Type} from "./action";

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

  findActions<T extends Action>(type: Type<T>, where?: (action: Action) => boolean) {
    return this._actions.filter(action => {
      if (!(action instanceof type)) {
        return;
      }

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
      this.findActions(filter.type, filter.where)
        .forEach((action: any) => {
          let wrapper = (next: Function, ...args: any[]) =>
            filter.filter(next, action, this)(...args);

          action[filter.name] = wrap(action[filter.name], wrapper);
        });
    });
  }
}
