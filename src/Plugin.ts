import { Registry } from "./Registry";
import { Filter } from "./filter";
import { Action, Params } from "./action";
import { Root } from "./action/Root";
import { Document } from "./Document";

import { Server, Request, ServerRoute } from "hapi";
import { assocPath, splitEvery, fromPairs, map } from "ramda";
import { posix } from "path";

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

export interface PluginAPI {
  registry: Registry;
  registerAction(action: Action | Action[]): void;
  registerFilter(filter: Filter<any, any> | Filter<any, any>[]): void;
  createdItem?: any;
}

export interface ResponseAPI {
  createdItem: any;
}

const DEFAULT_OPTIONS: Options = {
  root: "/",
  secure: true
};

export class Plugin implements PluginAPI {
  protected _options: Options;

  public registry = new Registry();

  constructor(protected readonly _server: Server, options: Partial<Options> = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...options };

    this._server.ext("onPreStart", () => {
      let root = new Root();

      if (this._options.secure) {
        if (!this._server.plugins["prism-security"]) {
          throw Error("Secure mode enabled but `prism-security` plugin has not been registered.");
        }

        root.routeOptions = assocPath(["auth", "mode"], "optional", root.routeOptions);
      }

      this.registerAction(root);
      this.registry.applyFilters();
    });
  }

  registerAction(action: Action | Action[]): void {
    if (action instanceof Array) {
      return action.forEach(action => this.registerAction(action));
    }

    action.path = posix.join(this._options.root, action.path);

    this.registry.registerObject(action);

    let route = toRoute(action);
    this._server.route(route);

    this._server.log("prism", `Action "${action.constructor.name}" routed to "${route.method}:${route.path}"`);
  }

  registerFilter(filter: Filter<Action, any> | Filter<Action, any>[]): void {
    this.registry.registerFilter(filter);
  }
}

export const toRoute = (action: Action): ServerRoute => ({
  path: dequery(action.path),
  method: action.method,
  options: action.routeOptions,
  handler: async request => {
    let params = mergeRequestParameters(request);
    let result = await action.handle(params, request);
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
