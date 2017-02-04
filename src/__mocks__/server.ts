import {Server} from "hapi";

export default class MockServer {
  protected _preStartFns: Function[] = [];

  plugins = {};
  connections = [];

  expose = jest.fn();
  route  = jest.fn();
  log    = jest.fn();

  ext = jest.fn().mockImplementation((event: string, fn: Function) => {
    if (event === "onPreStart") {
      this._preStartFns.push(fn);
    }
  });

  start() {
    this._preStartFns.forEach(fn => fn(this, () => {}));
  }
};
