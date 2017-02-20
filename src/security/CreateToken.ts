import {Action, Params, Filter} from "../action";
import {Root} from "../action/Root";
import {Document} from "../Document";
import {Backend} from "./backend";
import {Options} from "./Plugin";

import * as Promise from "bluebird";
import {Request} from "hapi";
import {sign} from "jsonwebtoken";

export class CreateToken implements Action {
  method = "POST";

  path = "token";

  constructor(protected _backend: Backend, protected _options: Options) {
  }

  handle = (params: Params, request: Request): Promise<any> =>
    this._backend.issue(request.payload)
      .then(token => {
        if (token === false) {
          let response = (request as any).generateResponse();
          response.code(403);

          return response;
        }

        return Promise.fromCallback(cb => sign(token, this._options.key, this._options.sign, cb))
          .then(token => ({token}));
      })

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
      filter: next => (doc, params, request) => {
        next(doc, params, request);

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
    }
  ];
}
