import Action, {Filter, Type} from "./action";

import {partition, always, wrap} from "ramda";

export default class Registry {
  protected _actions: Action[] = [];
  protected _filters: Filter<Action, any>[] = [];

  registerAction(action: Action): void {
    this._actions.push(action);

    if (action.filters) {
      action.filters.forEach(filter => this.registerFilter(filter));
    }
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    if (filter instanceof Array) {
      return filter.forEach(filter => this.registerFilter(filter));
    }

    this._filters.push(filter);
  }

  applyFilters(): void {
    this._filters.forEach(filter => {
      this._actions
        .forEach((action: any) => {
          if (!(action instanceof filter.type)) {
            return;
          }

          if (filter.where && filter.where(action) === false) {
            return;
          }

          action[filter.name] = wrap(action[filter.name], (next: Function, ...args: any[]) => {
            return filter.filter(next)(...args);
          });
        });
    });
  }
}
