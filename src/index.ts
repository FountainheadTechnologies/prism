import { Plugin, Options, PluginAPI, ResponseAPI } from "./Plugin";

import { Plugin as HapiPlugin } from "hapi";

declare module "hapi" {
  interface PluginProperties {
    prism: PluginAPI;
  }

  interface PluginsStates {
    prism?: Partial<ResponseAPI>;
  }
}

export const Prism: HapiPlugin<Partial<Options>> = {
  name: "prism",
  version: require("./package.json").version,
  register: async (server, options) => {
    let instance = new Plugin(server, options);
    server.expose("registry", instance.registry);
    server.expose("registerAction", instance.registerAction.bind(instance));
    server.expose("registerFilter", instance.registerFilter.bind(instance));
  }
};
