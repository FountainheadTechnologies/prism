import Plugin, {Options} from "./Plugin";

import {Server} from "hapi";

const registerPlugin = (server: Server, options: Partial<Options>, next: Function): void => {
  if (server.connections.length === 0) {
    throw new Error("Tried to load Prism before connections have been configured");
  }

  let instance = new Plugin(server, options);
  server.expose(instance.expose());

  next();
};

export default Object.assign(registerPlugin, {
  attributes: {
    pkg: require("./package.json")
  }
});
