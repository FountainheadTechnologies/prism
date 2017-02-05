import Registry from "./Registry";
import Action, {Filter, Params} from "./action";
import Root from "./action/Root";
import Document from "./Document";

import {resolve} from "bluebird";
import {Server, Request, IRouteConfiguration} from "hapi";
import {splitEvery, fromPairs, partition, wrap, pick, map} from "ramda";
import {join} from "path";

/**
 * Configuration options that the Prism plugin accepts
 */
export interface Options {
  /**
   * The root path that all actions will be published relative to
   * @default `""`
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
  root: "/",
  insecure: false
};

const EXPOSED_API: Array<keyof Plugin> = [
  "registerAction",
  "registerFilter"
];

export default class Plugin {
  protected _options: Options;

  protected _registry = new Registry();

  constructor(protected readonly _server: Server, options: Partial<Options> = {}) {
    this._options = {...DEFAULT_OPTIONS, ...options};
    this.registerAction(new Root());
  }

  registerAction(action: Action | Action[]): void {
    if (action instanceof Array) {
      return action.forEach(action => this.registerAction(action));
    }

    action.path = join(this._options.root, action.path);

    this._registry.registerAction(action);

    let route = toRoute(action);
    this._server.route(route);

    this._server.log("prism", `Action "${action.constructor.name}" routed to "${route.method}:${route.path}"`);
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    this._registry.registerFilter(filter);
  }

  expose(): Object {
    return map((value: any) => {
      if (typeof value === "function") {
        return value.bind(this);
      }

      return value;
    }, pick(EXPOSED_API, this) as any);
  }
}

export const toRoute = (action: Action): IRouteConfiguration => ({
  path:   dequery(action.path),
  method: action.method,
  config: action.routeConfig,
  handler(request, reply) {
    let start  = Date.now();
    let params = mergeRequestParameters(request);

    let dispatch = resolve(action.handle(params, request))
      .then(result => {
        if (!action.decorate) {
          return result;
        }

        let document = action.decorate(new Document(result), params, request);
        document.links.push({
          rel: "self",
          href: action.path,
          params
        });

        return document.render(params, request);
      });

    reply(dispatch);
  }
});

export const dequery = (path: string): string =>
  path.replace(/{\?.*?}/, "");

export const mergeRequestParameters = (request: Request): Params => {
  let queryParams = map((value: string) => {
    if (value.indexOf(",") < 0) {
      return value;
    }

    let parts = value.split(",");
    let pairs = splitEvery(2, parts) as any;
    return fromPairs(pairs);
  }, request.query);

  return {
    ...request.params,
    ...queryParams
  };
};
