import {Server} from "hapi";

const server = {
  expose: jest.fn(),
  route:  jest.fn(),
  log:    jest.fn(),
  ext:    jest.fn().mockImplementation((event: string, fn: Function) => fn(server, server._next)),
  _next:  jest.fn(),
  plugins: {},
  connections: []
}

export default server as any as Server;
