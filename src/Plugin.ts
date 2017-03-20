/**
 * Defines the 'Plugin' class and interfaces to implement Prism as a plugin for
 * Hapi
 * @module Plugin
 */

/**
 * required by typedoc-plugin-external-module-name
 */

import {Registry} from "./Registry";
import {Action, Filter, Params} from "./action";
import {Root} from "./action/Root";
import {Document} from "./Document";

import {Server, Request, IRouteConfiguration} from "hapi";
import {assocPath, splitEvery, fromPairs, partition, wrap, pick, map} from "ramda";
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
   * Explicitly enable "insecure" mode by setting to `false`. When not `false`
   * the Root action will be configured to use the `optional` authentication
   * mode. This is to allow non-authenticated clients to discover how to
   * authenticate.
   * @default `true`
   */
  secure: boolean;
}

/**
 * Default values to use for `Options` when creating a new Plugin
 */
const DEFAULT_OPTIONS: Options = {
  root: "/",
  secure: true
};

/**
 * Names of methods on Plugin that should be exposed via Hapi's plugin interface
 */
const EXPOSED_API: Array<keyof Plugin> = [
  "registerAction",
  "registerFilter"
];

/**
 * Implements Prism's core, a Hapi plugin which maintains a registry of Actions
 * and Filters, and exposes the ability to register Actions and Filters via
 * Hapi's plugin interface.
 *
 * It should not be necessary to create a Plugin instance manually, instead use
 * the `register` method on a Hapi server instance:
 *
 * ```
 * import {Server} from 'hapi';
 * import {Prism} from 'prism';
 *
 * var server = new Server();
 * server.register({
 *   register: Prism,
 *   options: {root: '/api'}
 * });
 * ```
 */
export class Plugin {
  /**
   * Contains configuration options passed to constructor, merged with defaults
   */
  protected _options: Options;

  /**
   * A Registry instance that Actions and Filters will be registered against.
   */
  protected _registry = new Registry();

  /**
   * @param _server The Hapi server instance that the Plugin is being registered against
   * @param options Options that were passed to the plugin registration method
   */
  constructor(protected readonly _server: Server, options: Partial<Options> = {}) {
    this._options = {...DEFAULT_OPTIONS, ...options};

    this._server.ext("onPreStart", (server, next) => {
      let root = new Root();

      if (this._options.secure) {
        if (!this._server.plugins["prism-security"]) {
          throw Error("Secure mode enabled but `prism-security` plugin has not been registered.");
        }

        root.routeConfig = assocPath(["auth", "mode"], "optional", root.routeConfig);
      }

      this.registerAction(root);
      this._registry.applyFilters();

      return next();
    });
  }

  /**
   * Registers an Action with `_registry`, creates a Hapi route definition and
   * adds it to the routing table
   */
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

  /**
   * Delegates to `_registry.registerFilter`
   */
  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    this._registry.registerFilter(filter);
  }

  /**
   * Once this Plugin instance has been initialized, `expose()` should be called
   * to create an object containing the methods and properties, bound to the
   * instance, that can be used as the public-facing API that is exposed through
   * `server.plugins.prism`
   */
  expose(): Object {
    return map((value: any) => {
      if (typeof value === "function") {
        return value.bind(this);
      }

      return value;
    }, pick(EXPOSED_API, this) as any);
  }
}

/**
 * Creates a Hapi route definition based upon an Action instance. The Route
 * definition also contains a `handler` function which perfoms the dispatch
 * process.
 *
 * @param action The Action to create a route definition for
 * @return The configured Hapi route definition, complete with `handler`
 * dispatch method
 */
export const toRoute = (action: Action): IRouteConfiguration => ({
  path:   dequery(action.path),
  method: action.method,
  config: action.routeConfig,
  async handler(request, reply) {
    let params = mergeRequestParameters(request);

    let dispatch = Promise.resolve(action.handle(params, request))
      .then(async result => {
        if (!action.decorate) {
          return result;
        }

        let document = new Document(result);
        await action.decorate(document, params, request);

        document.links.push({
          rel: "self",
          href: action.path,
          public: true,
          params
        });

        return document.render(params, request);
      });

    reply(dispatch);
  }
});

/**
 * Strips URI template placeholders that denote query string(s) for a path in
 * order to make it compatible with Hapi
 */
export const dequery = (path: string): string =>
  path.replace(/{\?.*?}/, "");

/**
 * Merges query parameters and URL part parameters in order to make it easier
 * for Actions to parse them
 */
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
