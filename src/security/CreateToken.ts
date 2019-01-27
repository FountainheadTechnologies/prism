import { Action, Params } from "../action";
import { Filter } from "../filter";
import { Root } from "../action/Root";
import { Backend } from "./backend";
import { Options } from "./Plugin";

import { Request, ResponseObject } from "hapi";
import { sign } from "jsonwebtoken";

export class CreateToken implements Action {
  method = "POST";

  path = "token";

  constructor(protected _backend: Backend, protected _options: Options) {
  }

  handle = async (params: Params, request: Request): Promise<ResponseObject> => {
    let token = await this._backend.issue(params, request);
    if (token === false) {
      let response = request.generateResponse(null);
      response.code(403);

      return response;
    }

    return new Promise<ResponseObject>((resolve, reject) => {
      sign(token as Object, this._options.key, this._options.sign, (err, token) => {
        if (err) {
          return reject(err);
        }

        let response = request.generateResponse({ token });
        response.code(201);
        return resolve(response);
      });
    });
  }

  routeOptions = {
    auth: false as false // typescript pls
  };

  register = this._backend;

  filters = [
    /**
     * Add a form for obtaining a token to the Root action
     */
    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: next => async (doc, params, request) => {
        doc = await next(doc, params, request);

        doc.forms.push({
          rel: "token",
          name: "create",
          href: this.path,
          method: this.method,
          schema: this._backend.schema,
          public: true,
          private: false
        });

        return doc;
      }
    },

    /**
     * Add a form for refreshing a token to the Root action
     */
    <Filter<Root, "decorate">>{
      type: Root,
      method: "decorate",
      filter: next => async (doc, params, request) => {
        doc = await next(doc, params, request);

        doc.forms.push({
          rel: "token",
          name: "refresh",
          href: this.path,
          method: this.method,
          schema: this._backend.schema
        });

        return doc;
      }
    }
  ];
}
