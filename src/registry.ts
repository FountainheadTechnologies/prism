import Action, {Filter, Type} from './action';

import {partition, always, wrap} from 'ramda';

export default class Registry {
  protected _actions: Action[] = [];
  protected _pendingFilters: Filter<Action, any>[] = [];

  registerAction(action: Action | Action[]): void {
    if (action instanceof Array) {
      return action.forEach(this.registerAction);
    }

    this._actions.push(action);

    if (action.filters) {
      action.filters.forEach(filter => this.registerFilter(filter));
    }
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    if (filter instanceof Array) {
      return filter.forEach(filter=> this.registerFilter(filter));
    }

    var toApply = [filter, ...this._pendingFilters]

    this._pendingFilters = toApply.filter(filter => {
      var applied = this.withAction(filter.type, filter.where || always(true), (action: any) => {
        action[filter.name] = wrap(action[filter.name], (next: Function, ...args: any[]) => {
          return filter.filter(next)(...args);
        });
      });

      return !applied;
    });
  }

  withAction(type: Type<Action>, where: (action: Action) => boolean, fn: (action: Action) => void): boolean {
    var match = this._actions.find(action => action instanceof type && where(action) === true);

    if (!match) {
      return false;
    }

    fn(match);

    return true;
  }
}
