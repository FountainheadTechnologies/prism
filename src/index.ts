import { Plugin, Options, ExposedAPI } from "./Plugin";

import { Server } from "hapi";

declare module "hapi" {
  interface PluginsStates {
    prism: ExposedAPI;
  }
}

const registerPlugin = (server: Server, options: Partial<Options>, next: Function): void => {
  if (server.connections.length === 0) {
    throw new Error("Tried to load Prism before connections have been configured");
  }

  let instance = new Plugin(server, options);
  server.expose("registry", instance.registry);
  server.expose("registerAction", instance.registerAction.bind(instance));
  server.expose("registerFilter", instance.registerFilter.bind(instance));

  next();
};

export const Prism = Object.assign(registerPlugin, {
  attributes: {
    name: "prism",
    version: require("./package.json").version
  }
});
