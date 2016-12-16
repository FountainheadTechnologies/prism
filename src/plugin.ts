import Registry from 'prism/registry';
import Action, {Filter} from 'prism/action';
import Root from 'prism/action/Root';

import {Server, IRouteConfiguration} from 'hapi';
import {partition, wrap} from 'ramda';

/**
 * Configuration options that the Prism plugin accepts
 */
export interface Options {
  /**
   * The root path that all actions will be published relative to
   * @default `''`
   */
  root: string;

  /**
   * Suppress the need for an authentication strategy to be configured before
   * starting the server by setting to `true`
   * @default `false`
   */
  insecure: boolean;
}

const DEFAULT_OPTIONS: Options = {
  root: '',
  insecure: false
}

export class Plugin {
  protected _options: Options;

  protected _registry = new Registry();

  constructor(protected readonly _server: Server, options: Partial<Options>) {
    this._options = {...DEFAULT_OPTIONS, options};
    this.registerAction(new Root());
  }

  registerAction(action: Action | Action[]): void {
    if (action instanceof Array) {
      return action.forEach(action => this.registerAction(action));
    }

    action.path = `${this._options.root}/${action.path}`;

    this._registry.registerAction(action);

    var route = toRoute(action);
    this._server.route(route);

    this._server.log('prism', `Action '${action.constructor.name}' routed to '${route.method}:${route.path}'`);
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    this._registry.registerFilter(filter);
  }
}

export const toRoute = (action: Action): IRouteConfiguration => ({
  path:   action.path,
  method: action.method,
  config: action.routeConfig,
});

export const registerPlugin = (server: Server, options: Partial<Options>, next: Function): void => {
  if (server.connections.length === 0) {
    throw new Error('Tried to load Prism before connections have been configured');
  }

  server.expose(new Plugin(server, options));

  next();
}

export default Object.assign(registerPlugin, {
  attributes: {
    pkg: require('../package.json')
  }
});
