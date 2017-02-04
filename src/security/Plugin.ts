import CreateToken from "./CreateToken";
import Backend from "./backend";
import Prism from "../Plugin";

import {Server} from "hapi";
import {map, pick} from "ramda";
import hapiJwt, {Options as JwtOptions} from "hapi-auth-jwt2";
import {SignOptions} from "jsonwebtoken";

export interface Options {
  /**
   * The private key to use for signing and verifying tokens
   */
  key: string;

  /**
   * Options that will be passed to the JWT signing function
   * @see https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback
   */
  sign: SignOptions;
}

export default class Plugin {
  protected _options: Options;

  protected _backend: Backend;

  constructor(protected readonly _server: Server, options: Partial<Options> = {}) {
    if (!options.key) {
      throw Error("Private key for token signing/verification was not specified");
    }

    this._options = {...DEFAULT_OPTIONS, ...options};

    _server.ext("onPreStart", (server, next) => {
      if (!this._backend) {
        throw Error("No Backend registered");
      }

      return next();
    });
  }

  registerBackend(backend: Backend): void {
    if (this._backend) {
      throw Error("A Backend has already been registered");
    }

    this._backend = backend;

    let prism = this._server.plugins["prism"] as Prism;

    if (this._backend.filters) {
      prism.registerFilter(this._backend.filters);
    }

    let createToken = new CreateToken(this._backend, this._options);
    prism.registerAction(createToken);
  }

  expose(): any {
    return map((value: any) => {
      if (typeof value === "function") {
        return value.bind(this);
      }

      return value;
    }, pick(EXPOSED_API, this) as any);
  }

  jwtOptions = (): JwtOptions => ({
    key: this._options.key,

    validateFunc: (decoded, request, next) => {
      return this._backend.validate(decoded, request)
        .then(result => {
          if (result === false) {
            return next(null, false);
          }

          return next(null, true, result);
        });
    }
  })
}

const DEFAULT_OPTIONS = {
  key: "thisApplicationIsNotSecure",
  sign: {}
};

const EXPOSED_API: Array<keyof Plugin> = [
  "registerBackend"
];
