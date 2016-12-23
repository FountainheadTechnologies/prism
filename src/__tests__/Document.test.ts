import Document from '../Document';
import {Params} from '../action';
import {users, tasks}  from '../__mocks__/resource';

import {Request} from 'hapi';

var document: Document;
var params: Params = {};
var request = undefined as any as Request;

beforeEach(() => {
  document = new Document();
});

describe('#render()', () => {
  it('returns an empty document', () => {
    expect(document.render(params, request)).toEqual({});
  });

  it('copies `properties` to top-level', () => {
    document.properties = {
      id: 'test-user',
      name: 'Test User'
    };

    expect(document.render(params, request)).toEqual({
      id: 'test-user',
      name: 'Test User'
    });
  });

  describe('._embedded', () => {
    it('recursively renders embedded documents', () => {
      var owner = new Document({
        id: 456,
        name: 'Test User 2'
      });

      Object.assign(owner, {
        links: [{
          rel: 'self',
          href: '/users/{id}',
          params: {
            id: 456
          }
        }]
      });

      Object.assign(document, {
        embedded: [{
          rel: 'owner',
          document: owner
        }],
        properties: {
          id: 123
        }
      });

      expect(document.render(params, request)).toEqual({
        id: 123,
        _embedded: {
          owner: {
            id: 456,
            name: 'Test User 2',
            _links: {
              self: {
                href: '/users/456'
              }
            }
          }
        }
      });
    });

    it('indexes multiple embeds with the same `rel`name as an array', () => {
      var users = [
        new Document({id: 1}),
        new Document({id: 2})
      ];

      Object.assign(document, {
        properties: {
          count: 2
        },
        embedded: [{
          rel: 'users',
          document: users[0]
        }, {
          rel: 'users',
          document: users[1]
        }]
      });

      expect(document.render(params, request)).toEqual({
        count: 2,
        _embedded: {
          users: [{
            id: 1,
          }, {
            id: 2
          }]
        }
      });
    });

    it('indexes single embeds as an array when `alwaysArray` is set', () => {
      var user = new Document({id: 1});

      Object.assign(document, {
        properties: {
          count: 1
        },
        embedded: [{
          rel: 'users',
          document: user,
          alwaysArray: true
        }]
      });

      expect(document.render(params, request)).toEqual({
        count: 1,
        _embedded: {
          users: [{
            id: 1
          }]
        }
      });
    });
  });

  describe('._links', () => {
    it('indexes by `rel`', () => {
      document.links = [{
        rel: 'users',
        href: '/users'
      }, {
        rel: 'tasks',
        href: '/tasks'
      }];

      expect(document.render(params, request)).toEqual({
        _links: {
          users: {
            href: '/users'
          },
          tasks: {
            href: '/tasks'
          }
        }
      });
    });

    it('indexes multiple links with the same `rel` name as an array', () => {
      document.links = [{
        rel: 'users',
        name: 'collection',
        href: '/users'
      }, {
        rel: 'users',
        href: '/users'
      }, {
        rel: 'tasks',
        href: '/tasks'
      }];

      expect(document.render(params, request)).toEqual({
        _links: {
          users: [{
            href: '/users',
            name: 'collection'
          }, {
            href: '/users'
          }],
          tasks: {
            href: '/tasks'
          }
        }
      });
    });

    it('sets `templated: true` when `href` is a URI template but no params are given', () => {
      document.links = [{
        rel: 'users',
        href: '/users/{id}'
      }];

      expect(document.render(params, request)).toEqual({
        _links: {
          users: {
            href: '/users/{id}',
            templated: true
          }
        }
      });
    });

    it('fills a URI template with values when params are given', () => {
      document.links = [{
        rel: 'users',
        href: '/users/{id}',
        params: {
          id: 1337
        }
      }];

      expect(document.render(params, request)).toEqual({
        _links: {
          users: {
            href: '/users/1337'
          }
        }
      });
    });
  });

  describe('._forms', () => {
    it('indexes by `rel`', () => {
      document.forms = [{
        rel: 'users',
        href: '/users',
        name: 'create',
        method: 'POST',
        schema: users.schema
      }, {
        rel: 'tasks',
        href: '/tasks',
        name: 'create',
        method: 'POST',
        schema: tasks.schema
      }];

      expect(document.render(params, request)).toEqual({
        _forms: {
          users: {
            href: '/users',
            name: 'create',
            method: 'POST',
            schema: users.schema
          },
          tasks: {
            href: '/tasks',
            name: 'create',
            method: 'POST',
            schema: tasks.schema
          }
        }
      });
    });
  });
});
