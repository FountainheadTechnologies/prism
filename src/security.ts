import { Plugin, Options, ExposedAPI } from "./security/Plugin";

import { Server } from "hapi";
import * as hapiJwt from "hapi-auth-jwt2";

declare module "hapi" {
  interface PluginsStates {
    "prism-security": ExposedAPI;
  }
}

const registerPlugin = (server: Server, options: Partial<Options>, next: Function): void => {
  let instance = new Plugin(server, options);
  server.expose('registerBackend', instance.registerBackend.bind(instance));

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

export { Resource as ResourceBackend } from "./security/backend/Resource";
