import {Action, Params, Filter} from "../action";
import {Root} from "../action/Root";
import {Document} from "../Document";
import {Backend} from "./backend";
import {Options} from "./Plugin";

import {Request, Response} from "hapi";
import {sign} from "jsonwebtoken";

export class CreateToken implements Action {
  method = "POST";

  path = "token";

  constructor(protected _backend: Backend, protected _options: Options) {
  }

  handle = async (params: Params, request: Request): Promise<Response> => {
    let token = await this._backend.issue(request.payload);
    if (token === false) {
      let response = (request as any).generateResponse();
      response.code(403);

      return response;
    }

    return new Promise<Response>((resolve, reject) => {
      sign(token, this._options.key, this._options.sign, (err, token) => {
        if (err) {
          return reject(err);
        }

        let response = (request as any).generateResponse({token});
        response.code(201);
        return resolve(response);
      });
    });
  }

  routeConfig = {
    auth: false
  };

  filters = [
    /**
     * Add a form for obtaining a token to the Root action
     */
    <Filter<Root, "decorate">>{
      type: Root,
      name: "decorate",
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
      name: "decorate",
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
