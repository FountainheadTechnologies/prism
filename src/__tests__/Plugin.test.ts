import Plugin, {toRoute} from '../Plugin';
import server from '../__mocks__/server';

import {T, identity} from 'ramda';
import {resolve} from 'bluebird';

var plugin: Plugin;
var action: any;

beforeEach(() => {
  plugin = new Plugin(server, {
    root: '/test'
  });

  action = {
    method: 'POST',
    path: '/users',
    handle: jest.fn().mockReturnValue({
      id: 1337
    }),
    decorate: jest.fn().mockImplementation(identity)
  };
});

it('registers a root action', () => {
  expect(server.route).toHaveBeenCalledWith({
    handler: jasmine.any(Function),
    method:  'GET',
    path:    '/test'
  });
});

describe('#registerAction()', () => {
  it('adds `root` suffix to Action `path` property', () => {
    plugin.registerAction(action);
    expect(action.path).toBe('/test/users');
  });

  it('registers route with server', () => {
    plugin.registerAction(action);
    expect(server.route).toHaveBeenCalledWith({
      handler: jasmine.any(Function),
      method:  'POST',
      path:    '/test/users'
    });
  });
});

describe('#expose()', () => {
  it('exposes public methods, bound to instance', () => {
    var {registerAction}:any = plugin.expose();

    registerAction(action);
    expect(server.route).toHaveBeenCalledWith({
      handler: jasmine.any(Function),
      method:  'POST',
      path:    '/test/users'
    });
  });
});

describe('toRoute()', () => {
  var route: any;

  beforeEach(() => {
    route = toRoute(action);
  });

  it('strips URI template placeholders from path', () => {
    action.path = '/test/users{?where,page,order}';
    var route = toRoute(action);

    expect(route.path).toBe('/test/users');
  });

  describe('.handler()', () => {
    var request: any;

    beforeEach(() => {
      request = {
        params: {
          method: 'GET'
        },
        query: {
          where: 'owner,2'
        }
      };
    });

    it('calls `action.handle()` with merged URI template parameters', () => {
      route.handler(request, T);

      expect(action.handle).toHaveBeenCalledWith({
        method: 'GET',
        where: {
          owner: '2'
        }
      }, request);
    });

    it('creates a document with result of `action.handle()` and renders it', () => {
      var dispatch = resolve();

      route.handler(request, (_dispatch: any) => {dispatch = _dispatch});

      return dispatch.then(response => {
        expect(response).toEqual({
          _links: {
            self: {
              href: '/users'
            }
          },
          id: 1337
        });
      });
    });
  });
});
