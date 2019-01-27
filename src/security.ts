import { Plugin, Options, PluginAPI } from "./security/Plugin";

import { Plugin as HapiPlugin } from "hapi";
import * as hapiJwt from "hapi-auth-jwt2";

declare module "hapi" {
  interface PluginProperties {
    "prism-security": PluginAPI;
  }
}

export const PrismSecurity: HapiPlugin<Partial<Options>> = {
  name: "prism-security",
  version: require("./package.json").version,
  register: async (server, options) => {
    let instance = new Plugin(server, options);
    server.expose("registerBackend", instance.registerBackend.bind(instance));

    await server.register(hapiJwt);
    server.auth.strategy("prism-security", "jwt", instance.jwtOptions());
    server.auth.default("prism-security");
  }
};

export { Resource as ResourceBackend } from "./security/backend/Resource";
