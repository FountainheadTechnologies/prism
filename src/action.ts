/**
 * Defines the Action interface that all Actions should implement, and the
 * Filter interface and supporting types
 * @module action
 */

/**
 * required by typedoc-plugin-external-module-name
 */

import {Resource} from "./resource";
import {Document} from "./Document";
import {Registry} from "./Registry";

import {
  Request,
  Response,
  IRouteAdditionalConfigurationOptions
} from "hapi";

/**
 * Typical request parameters that the built-in Actions support
 */
export interface Params {
  /**
   * 'where' constraints, keyed by field name
   */
  where?: {
    [key: string]: string;
  };

  /**
   * Order definition, keyed by field name
   */
  order?: {
    [key: string]: "asc" | "desc";
  };

  /**
   * The page number to request
   */
  page?: string;

  /**
   * Allows additional parameters to be specified by custom Action
   * implementations
   */
  [key: string]: any;
}

/**
 * An Action implements some kind of logic for a given HTTP method. For example,
 * modifying or reading a single resource.
 *
 * All Actions must implement this interface in order to be routable by the Hapi
 * plugin and interact correctly with built-in Actions.
 */
export interface Action {
  /**
   * The HTTP method that this Action responds to
   */
  readonly method: string;

  /**
   * Additional Hapi route configuration options
   */
  routeConfig?: IRouteAdditionalConfigurationOptions;

  /**
   * The path that this Action responds to. If the Plugin contains a 'root'
   * configuration option, then it will be predended to `path`.
   */
  path: string;

  /**
   * The 'entry-point' for an Action. When a request is routed to an Action,
   * handle will be called first. This is typically where the Action will
   * interact with a resource.
   *
   * @param handle.params The URL and query parameters that were present in
   * `request`
   * @param handle.request The Hapi request object
   * @return Resolves to some form of intermediate data structure as an Object.
   * This Object will be used to construct a Document instance that will be
   * passed to `decorate()`. If further control over the response is required,
   * then a Hapi Response object may be resolved instead.
   */
  handle: (params: Params, request?: Request) => Promise<Response | {}>;

  /**
   * Applies any custom decorations to the Document based upon the semantics
   * that this Action implements.
   *
   * @param decorate.doc A Document that was constructed using the return value
   * of `handle()`
   * @param decorate.params The URL and query parameters that were present in
   * `request`
   * @param decorate.request The Hapi request object
   * @return Resolves to a Document that may or may not be the same `doc` that
   * was passed in.
   */
  decorate?: (doc: Document, params?: Params, request?: Request) => Promise<Document>;

  /**
   * An Action may specify Filters which will be applied to any other Actions
   * that are registered with the same Registry.
   *
   * This cross-cutting mechanism is the core of Prism's power and flexibility.
   * It allows Actions to augment other Actions transparently.
   *
   * "Ask not what other Actions can do for you-- ask what you can do for other Actions."
   */
  filters?: Array<Filter<Action, any> | Array<Filter<Action, any>>>;
}

/**
 * Defines a function as the constructor for class `T`
 */
export interface Type<T> {
  new (...args: any[]): T;
}

/**
 * A Filter object allows an arbitrary function to run 'in front' of an
 * arbitrary instance method. Filters are the core of Prism's power and
 * flexibility.
 *
 * They allow Actions and user-defined behaviour to cross-cut each other in a
 * type-safe and predictable manner.
 *
 * An example of a Filter that completely bypasses the underlying implementation
 * and returns an arbitrary value:
 * ```
 * <Filter<ReadItem, 'handle'>>{
 *   type: ReadItem,
 *   name: 'handle',
 *   filter: next => async (params, request) =>
 *     request.generateResponse().code(404)
 * }
 * ```
 *
 * An example of a Filter that calls the underlying implementation, but modifies
 * the input parameters:
 * ```
 * <Filter<ReadItem, 'handle'>>{
 *   type: ReadItem,
 *   name: 'handle',
 *   filter: next => async (params, request) => {
 *     params.where['deleted'] = false;
 *     return next(params, request);
 *   }
 * }
 * ```
 *
 * An example of a Filter that calls the underlying implementation, but modifies
 * the return value:
 * ```
 * <Filter<ReadItem, 'handle'>>{
 *   type: ReadItem,
 *   name: 'handle',
 *   filter: next => async (params, request) => {
 *     var result = await next(params, request);
 *     result.foo = 'bar';
 *     return result;
 *   }
 * }
 * ```
 *
 * @param T The type (ie, constructor function) that this Filter should apply
 * to. Note that although the `type` property accepts an array of constructors,
 * this type parameter only accepts one. When applying the same filter to
 * different Action types, ensure that `T[K]` has the same signature in all
 * cases.
 * @param K The name of the method that this Filter should apply to.
 */
export interface Filter<T, K extends keyof T> {
  /**
   * The type(s) that this filter should apply to. Match will be tested using an
   * `instanceof` check.
   */
  type: Type<T> | Type<T>[];

  /**
   * The name of the method to apply the filter to.
   */
  name: K;

  /**
   * A predicate function, useful for applying a Filter to a specific instance
   * of a given `type`.
   *
   * The filter will only be applied to Actions matching `type` when `where`
   * returns `true`.
   */
  where?: (action: T) => boolean;

  /**
   * The Filter function to apply if `type` and `where` match.
   *
   * @param filter.next The next implementation in the 'chain'. This allows a Filter to
   * invoke the underlying implementation if necessary.
   * @param filter.self The instance that the filter was applied to. This allows a
   * Filter to access other methods on the underlying class if necessary.
   * @param filter.registry The Registry instance that contains the Action and Filter
   * being applied. Seldom necessary, but included for completeness.
   * @return The filter implementation itself, which should match the signature of the
   * method being filtered.
   */
  filter: (next: T[K], self: T, registry: Registry) => T[K];
}

export {ReadItem} from "./action/ReadItem";
export {ReadCollection} from "./action/ReadCollection";
export {CreateItem} from "./action/CreateItem";
export {UpdateItem} from "./action/UpdateItem";
export {DeleteItem} from "./action/DeleteItem";
