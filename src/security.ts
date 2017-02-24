import {Plugin, Options} from "./security/Plugin";

import {Server} from "hapi";
import * as hapiJwt from "hapi-auth-jwt2";

const registerPlugin = (server: Server, options: Partial<Options>, next: Function): void => {
  let instance = new Plugin(server, options);
  server.expose(instance.expose());

  server.register(hapiJwt)
    .then(() => server.auth.strategy("prism-security", "jwt", true, instance.jwtOptions()))
    .then(() => next());
};

export const PrismSecurity = Object.assign(registerPlugin, {
  attributes: {
    name: "prism-security",
    version: require("./package.json").version
  }
});
