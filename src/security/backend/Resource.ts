import { Backend } from "../backend";
import { Resource as _Resource } from "../../resource";
import { Root, ReadItem, CreateItem, UpdateItem, Params } from "../../action";
import { Filter } from "../../filter";
import { Source } from "../../source";
import { Schema, validate } from "../../schema";
import * as query from "../../query";

import { pick, pathEq, partialRight } from "ramda";
import { hash, compare } from "bcrypt";
import { Request } from "hapi";

/**
 * Security backend that performs authentication using a Prism Resource
 */
export class Resource implements Backend {
  protected _options: Options;

  schema: Schema;

  constructor(readonly resource: _Resource, options: Partial<Options> = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...options };

    this.schema = {
      $schema: "http://json-schema.org/draft-04/schema#",
      title: "token",
      type: "object",

      properties: {
        [this._options.identity]: { type: "string" },
        [this._options.password]: { type: "string" }
      },

      required: [
        this._options.identity,
        this._options.password
      ]
    };
  }

  issue = async (params: Params, request: Request): Promise<false | Object> => {
    let query = await this.issueQuery(params, request);
    let result;

    try {
      await validate(request.payload, this.schema);
      result = await this.resource.source.read(query);
    } catch (error) {
      if (error.isBoom && error.output && error.output.statusCode === 404) {
        return false;
      }

      throw error;
    }

    if (result === null) {
      /**
        * @todo This leads to discovery of valid usernames through a timing
        * attack; make it constant-time
        */
      return false;
    }

    let given = request.payload[this._options.password];
    let actual = (result as any)[this._options.password];
    let match = await this._options.compare(given, actual);

    if (match === false) {
      return false;
    }

    return {
      [this.resource.name]: pick(this.resource.primaryKeys, result)
    };
  }

  issueQuery = async (params: Params, request: Request): Promise<query.Read> => ({
    source: this.resource.name,
    schema: this.schema,
    return: "item",
    conditions: [
      ...this._options.scope, {
        field: this._options.identity,
        value: request.payload[this._options.identity]
      }
    ]
  })

  validateQuery = async (decoded: any, request: Request): Promise<query.Read> => ({
    source: this.resource.name,
    schema: this.schema,
    return: "item",
    conditions: [
      ...this._options.scope,
      ...this.resource.primaryKeys.map(key => ({
        field: key,
        value: decoded[this.resource.name][key]
      }))
    ]
  })

  validate = async (decoded: any, request: Request): Promise<false | Object> => {
    let query = await this.validateQuery(decoded, request);

    return this.resource.source.read(query)
      .catch(err => false);
  }

  register = this.resource.source;

  filters = [
    /**
     * Redact the password field when it appears in results from `ReadItem`
     */
    <Filter<ReadItem, "decorate">>{
      type: ReadItem,
      method: "decorate",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (doc, params, request) => {
        await next(doc, params, request);

        doc.properties[this._options.password] = this._options.redact;

        return doc;
      }
    },

    /**
     * Hash passwords supplied through `Create` and `Update` forms before
     * persisting
     */
    <Filter<CreateItem, "handle">>{
      type: [CreateItem, UpdateItem],
      method: "handle",
      where: pathEq(["resource", "name"], this.resource.name),
      filter: next => async (params, request) => {
        if (request.payload[this._options.password]) {
          let hash = await this._options.hash(request.payload[this._options.password]);
          request.payload[this._options.password] = hash;
        }

        return next(params, request);
      }
    },

    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: (next, self, registry) => async (doc, params, request) => {
        await next(doc, params, request);

        if (!request.auth || request.auth.error) {
          return doc;
        }

        let read = registry.findObjects([ReadItem], pathEq(["resource", "name"], this.resource.name))[0];
        if (!read) {
          return doc;
        }

        doc.links.push({
          rel: this.resource.name,
          name: "identity",
          href: read.path,
          params: pick(this.resource.primaryKeys, request.auth.credentials),
        });

        return doc;
      }
    }
  ];
}

/**
 * Configuration options for the `Resource` security backend
 */
export interface Options {
  /**
   * The resource property that contains a human-readable identity, such as a
   * username or email address
   * @default `"username"`
   */
  identity: string;

  /**
   * The resource property that contains a secret string, ie password
   * @default `"password"`
   */
  password: string;

  /**
   * Automatically replace the value of `password` within Documents that are generated by the bound Resource
   * @default `"**REDACTED**"`
   */
  redact: string;

  /**
   * The comparison function that will be used to check `password` when a token
   * is issued, typically involving some kind of cryptographic hashing strategy.
   *
   * @param given The password that was specified when attempting to issue a
   * token
   * @param actual The actual value that the resource query returned
   * @return Promise that resolves to `true` if `given` matches `actual`,
   * otherwise resolves to `false`
   * @default A Promisified version of `bcrypt.compare`
   */
  compare: (given: string, actual: string) => Promise<boolean>;

  /**
   * The hashing function that will be used to automatically hash passwords when
   * creating or updating a document in the bound `Resource`.
   *
   * @param given The password to be hashed
   * @return Promise that resolves to the hashed value of `password`
   * @default A Promisified version of `bcrypt.hash` using 10 rounds.
   */
  hash: (given: string) => Promise<string>;

  /**
   * Additional `Condition` clauses to apply when performing queries during token
   * issuing and verification
   */
  scope: query.Condition[];
}

const DEFAULT_OPTIONS: Options = {
  identity: "username",
  password: "password",
  redact: "**REDACTED**",

  compare: compare,
  hash: partialRight(hash, [4]) as any,

  scope: []
};
