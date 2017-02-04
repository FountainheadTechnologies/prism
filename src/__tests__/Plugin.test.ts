import Plugin, {toRoute} from "../Plugin";
import server from "../__mocks__/server";

import {T, identity} from "ramda";
import {resolve} from "bluebird";

let plugin: Plugin;
let action: any;

beforeEach(() => {
  plugin = new Plugin(server, {
    root: "/test",
    secure: false
  });

  action = {
    method: "POST",
    path: "/users",
    handle: jest.fn().mockReturnValue({
      id: 1337
    }),
    decorate: jest.fn().mockImplementation(identity)
  };
});

it("registers a root action", () => {
  let onPreStartFn = (server.ext as jest.Mock<any>).mock.calls[0][1];
  onPreStartFn(server, () => {});

  expect(server.route).toHaveBeenCalledWith({
    handler: jasmine.any(Function),
    method:  "GET",
    path:    "/test",
    config:  {}
  });
});

describe("when `options.secure` is not set to false", () => {
  describe("when `prism-security` plugin has not been registered", () => {
    it("throws an error", () => {
      let fn = () => {
        plugin = new Plugin(server, {
          root: "/test"
        });

        let onPreStartFn = (server.ext as jest.Mock<any>).mock.calls[0][1];
        onPreStartFn(server, () => {});
      };

      expect(fn).toThrowError("Secure mode enabled but `prism-security` plugin has not been registered");
    });
  });

  it("mutates the the root action to contain `optional` auth mode", () => {
    server.plugins["prism-security"] = "mockSecurityPlugin";

    plugin = new Plugin(server, {
      root: "/test"
    });

    let onPreStartFn = (server.ext as jest.Mock<any>).mock.calls[0][1];
    onPreStartFn(server, () => {});

    expect(server.route).toHaveBeenCalledWith({
      handler: jasmine.any(Function),
      method:  "GET",
      path:    "/test",
      config:  {
        auth: {
          mode: "optional"
        }
      }
    });
  });
});

describe("#registerAction()", () => {
  it("adds `root` suffix to Action `path` property", () => {
    plugin.registerAction(action);
    expect(action.path).toBe("/test/users");
  });

  it("registers route with server", () => {
    plugin.registerAction(action);
    expect(server.route).toHaveBeenCalledWith({
      handler: jasmine.any(Function),
      method:  "POST",
      path:    "/test/users"
    });
  });
});

describe("#expose()", () => {
  it("exposes public methods, bound to instance", () => {
    let {registerAction}: any = plugin.expose();

    registerAction(action);
    expect(server.route).toHaveBeenCalledWith({
      handler: jasmine.any(Function),
      method:  "POST",
      path:    "/test/users"
    });
  });
});

describe("toRoute()", () => {
  let route: any;

  beforeEach(() => {
    route = toRoute(action);
  });

  it("strips URI template placeholders from path", () => {
    action.path = "/test/users{?where,page,order}";
    let route = toRoute(action);

    expect(route.path).toBe("/test/users");
  });

  describe(".handler()", () => {
    let request: any;

    beforeEach(() => {
      request = {
        auth: {},
        params: {
          method: "GET"
        },
        query: {
          where: "owner,2"
        }
      };
    });

    it("calls `action.handle()` with merged URI template parameters", () => {
      route.handler(request, T);

      expect(action.handle).toHaveBeenCalledWith({
        method: "GET",
        where: {
          owner: "2"
        }
      }, request);
    });

    it("creates a document with result of `action.handle()` and renders it", () => {
      let dispatch = resolve();

      route.handler(request, (_dispatch: any) => {
        dispatch = _dispatch;
      });

      return dispatch.then(response => {
        expect(response).toEqual({
          _links: {
            self: {
              href: "/users"
            }
          },
          id: 1337
        });
      });
    });
  });
});
