import Schema from "../schema";
import {Filter} from "../action";

import {Request} from "hapi";
import * as Promise from "bluebird";

/**
 * A security backend implements the checking of preconditions when issuing a
 * new token or validating an existing one presented in an HTTP request
 */
interface Backend {
  /**
   * Issue a new token based upon a request's payload
   *
   * @param payload The Request payload containing parameters to use for
   * determining whether a new token may be issued
   * @return A promise that will resolve to `false` if the token should not be
   * issued (ie, preconditions have not been met), or an Object containing the
   * data to be included in the token payload
   */
  issue(payload: Object): Promise<boolean | Object>;

  /**
   * Validate a token that was presented in a Request
   *
   * @param request The Request containing the token
   * @param token The Token that was presented in `request`
   * @return A Promise that will resolve to `false` if the token is invalid, or
   * an Object that should be memoized for the duration of the request/response
   * cycle, such as the authenticated user's details
   */
  validate(token: Object, request: Request): Promise<boolean | Object>;

  /**
   * The JSON Schema document that will be used to validate request payloads
   * when issuing a token
   */
  schema: Schema;

  /**
   * Optional filters that the Backend will apply to other Actions
   */
  filters?: Array<Filter<any, any>>;
}

export default Backend;
