import {Server} from 'hapi';
import * as _pgPromise from 'pg-promise';
import * as collimator from 'collimator';
import {whereEq} from 'ramda';
import {Response} from 'node-fetch';
import {Prism} from '@warrenseymour/prism';
import {PrismSecurity, ResourceBackend} from '@warrenseymour/prism/security';
import {PostgreSQL} from '@warrenseymour/prism/source';
import * as action from '@warrenseymour/prism/action';
import {fetch, getProperties} from './common/util';

const pgPromise = _pgPromise();

var server: Server;

var db = pgPromise({
  database: 'prism-integration-test',
  host: process.env.POSTGRES_HOST || '/var/run/postgresql',
  user: process.env.POSTGRES_USER,
});

beforeAll(async () => {
	server = new Server();
	server.connection({port: 8080});

  await server.register(Prism);
  await server.register({
    register: PrismSecurity,
    options: {
      key: 'superSecretIntegrationTestPrivateKey'
    }
  })

  var metadata = await collimator.inspect(db);
  var source = new PostgreSQL(db);

  metadata.tables.forEach(table => {
    var resource = {...table, source};
    server.plugins['prism'].registerAction(new action.ReadItem(resource));
    server.plugins['prism'].registerAction(new action.ReadCollection(resource));
    server.plugins['prism'].registerAction(new action.CreateItem(resource));
    server.plugins['prism'].registerAction(new action.UpdateItem(resource));
    server.plugins['prism'].registerAction(new action.DeleteItem(resource));

    if (table.name === 'users') {
      server.plugins['prism-security'].registerBackend(new ResourceBackend(resource, {
        scope: [{
          field: 'enabled',
          value: true
        }]
      }));
    }
  });

  await server.start();
});

afterAll(async () => {
  await server.stop();
  await pgPromise.end();
});

describe('No token', () => {
  describe('GET / (Root)', () => {
    var document;

    beforeAll(async () => {
      var response = await fetch('http://localhost:8080');
      document = await response.json();
    });

    it('contains a `self` link', () => {
      expect(document._links).toEqual({
        self: {
          href: '/'
        }
      });
    });

    it('contains a `token:create` form', () => {
      expect(document._forms).toEqual({
        token: {
          name: 'create',
          method: 'POST',
          href: '/token',
          schema: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            title: 'token',
            type: 'object',
            properties: {
              username: {
                type: 'string'
              },
              password: {
                type: 'string'
              }
            },
            required: [
              'username',
              'password'
            ]
          }
        }
      });
    });
  });

  var tests = [{
    name: 'GET /tasks (ReadCollection)',
    path: '/tasks'
  }, {
    name: 'GET /tasks/2 (ReadItem)',
    path: '/tasks/2'
  }, {
    name: 'GET /tasks/200 (ReadItem with invalid ID)',
    path: '/tasks/200'
  }, {
    name: 'POST /tasks (CreateItem)',
    path: '/tasks',
    options: {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Task without token',
        owner_id: 1,
        project_id: 1
      })
    },
    tests: [{
      name: 'does not create the Task',
      fn: async () => {
        var {count} = await db.one('SELECT COUNT(*) FROM tasks');
        expect(count).toBe('100');
      }
    }]
  }, {
    name: 'PATCH /tasks/2 (UpdateItem)',
    path: '/tasks/2',
    options: {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Changed title without token'
      })
    },
    tests: [{
      name: 'does not modify the Task',
      fn: async () => {
        var task = await db.one('SELECT * from tasks WHERE id=2');
        expect(task).toEqual({
          complete: true,
          description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
          id: 2,
          owner: 2,
          project: 2,
          title: "calculate bluetooth array"
        });
      }
    }]
  }, {
    name: 'DELETE /tasks/2 (DeleteItem)',
    path: '/tasks/2',
    options: {
      method: 'DELETE'
    },
    tests: [{
      name: 'does not delete the Task',
      fn: async () => {
        var {count} = await db.one('SELECT COUNT(*) from tasks');
        expect(count).toBe('100');
      }
    }]
  }];

  tests.forEach(test => {
    describe(test.name, () => {
      var response: Response;

      beforeAll(async () => {
        response = await fetch(`http://localhost:8080${test.path}`, test['options']);
      });

      it('responds with a 401 status code', () => {
        expect(response.status).toBe(401);
      });

      it('contains error message in body', async () => {
        var error = await response.json();
        expect(error).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Missing authentication'
        });
      });

      if (test['tests']) {
        test['tests'].forEach(test => {
          it(test.name, test.fn);
        });
      }
    })
  });

  describe('POST /token', () => {
    var tests = [{
      name: 'invalid username',
      username: 'Unknown',
      password: '??'
    }, {
      name: 'invalid password',
      username: 'Kaley6',
      password: '1234'
    }, {
      name: 'valid credentials that fail scope requirement',
      username: 'Jeffrey_Hayes',
      password: 'Jeffrey_Hayes-password'
    }];

    tests.forEach(test => {
      describe(test.name, () => {
        var response: Response;

        beforeAll(async() => {
          response = await fetch('http://localhost:8080/token', {
            method: 'POST',
            body: JSON.stringify({
              username: test.username,
              password: test.password
            })
          })
        });

        it('responds with a 403 status', () => {
          expect(response.status).toBe(403);
        });

        it('contains empty body', async () => {
          var body = await response.text();
          expect(body).toBe('');
        });
      });
    });

    describe('valid credentials', () => {
      var response: Response;
      var body: {
        token: string
      };

      beforeAll(async() => {
        response = await fetch('http://localhost:8080/token', {
          method: 'POST',
          body: JSON.stringify({
            username: 'Kaley6',
            password: 'Kaley6-password'
          })
        });

        body = await response.json();
      });

      it('responds with a 201 status', () => {
        expect(response.status).toBe(201);
      });

      it('contains token in body', async () => {
        expect(body).toEqual({
          token: jasmine.any(String)
        })
      });

      it('contains `users`, `iat` and `exp` properties in token payload', async () => {
        var parts = body.token.split('.');
        var payload = JSON.parse(atob(parts[1]));
        expect(payload).toEqual({
          users: {
            id: 2
          },
          iat: jasmine.any(Number),
          exp: jasmine.any(Number)
        });

        var now = Math.floor(Date.now() / 1000);
        expect(payload.iat).toBeCloseTo(now, 1);
        expect(payload.exp).toBeCloseTo(now + 24 * 60 * 60, 1);

        process.env.REQUEST_TOKEN = body.token;
      });
    });
  });
});

describe('Valid token', () => {
  require('./common.ts');

  describe('GET / (Root)', () => {
    var document;

    beforeAll(async () => {
      var response = await fetch('http://localhost:8080');
      document = await response.json();
    });

    it('contains an `identity` link', () => {
      expect(document._links.users).toContainEqual({
        name: 'identity',
        href: '/users/2'
      });
    });

    it('does not contain a `token:create` form', () => {
      expect(document._links.token).toBeUndefined();
    });

    it('contains a `token:refresh` form', () => {
      expect(document._forms.token).toEqual({
        name: 'refresh',
        method: 'POST',
        href: '/token',
        schema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'token',
          type: 'object',
          properties: {
            username: {
              type: 'string'
            },
            password: {
              type: 'string'
            }
          },
          required: [
            'username',
            'password'
          ]
        }
      });
    });
  });

  describe('GET /users/1 (ReadItem)', () => {
    it('redacts password', async () => {
      var response = await fetch('http://localhost:8080/users/1');
      var user = await response.json();

      expect(getProperties(user)).toEqual({
        id: 1,
        username: 'Freddy_Feil48',
        password: '**REDACTED**',
        enabled: true,
        department: 1,
      });
    });
  });

  describe('POST /users (CreateItem)', () => {
    it('automatically hashes the password', async () => {
      var result = await fetch('http://localhost:8080/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'new-user',
          password: 'new-password',
          department: 1
        })
      });

      var {password} = await db.one('SELECT password FROM users WHERE id=9');
      expect(password.substring(0, 7)).toEqual('$2a$04$');
    });
  });

  describe('PATCH /users (UpdateItem)', () => {
    it('automatically hashes the password', async () => {
      await fetch('http://localhost:8080/users/1', {
        method: 'PATCH',
        body: JSON.stringify({
          password: 'new-password'
        })
      });

      var {password} = await db.one('SELECT password FROM users WHERE id=1');
      expect(password.substring(0, 7)).toEqual('$2a$04$');
    });
  });
});
