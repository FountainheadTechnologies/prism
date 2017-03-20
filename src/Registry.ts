/**
 * Defines the 'Registry' class
 * @module Registry
 */

/**
 * required by typedoc-plugin-external-module-name
 */

import {Action, Filter, Type} from "./action";

import {partition, always, wrap} from "ramda";

/**
 * A Registry instance acts as a container for Actions and Filters. In order for
 * Filters to be applied to Actions, both must be registered with the same
 * Registry instance.
 *
 * It should not be necessary to create a Registry yourself, as this is handled
 * by `Plugin`.
 */
export class Registry {
  /**
   * An internal store of all Actions that have been registered. Do not access
   * directly, use `registerAction` instead.
   */
  protected _actions: Action[] = [];

  /**
   * An internal store of all Filter objects that have been registered. Do not
   * access directly, use `registerFilter` instead.
   */
  protected _filters: Filter<Action, any>[] = [];

  /**
   * Register an Action with this registry. If `action` contains a `filters`
   * property, then also register those Filters here.
   */
  registerAction(action: Action): void {
    this._actions.push(action);

    if (action.filters) {
      action.filters.forEach(filter => this.registerFilter(filter));
    }
  }

  /**
   * Attempts to locate registered Actions according to `types` and `where`.
   *
   * @param types An array of constructor functions to locate an Action using an
   * `instanceof` check.
   * @param where A predicate function to disambiguate between multiple Actions
   * of the same type.
   * @return An array of Actions that are of type `types` and pass the `where`
   * predicate function
   */
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

  /**
   * Register a Filter with this registry.
   */
  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    if (filter instanceof Array) {
      return filter.forEach(filter => this.registerFilter(filter));
    }

    this._filters.push(filter);
  }

  /**
   * Apply each registered Filter to all registered matching Actions.
   */
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
