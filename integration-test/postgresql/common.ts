import {Response} from 'node-fetch';
import * as schemas from './common/schemas';
import {fetch, getProperties} from './common/util';

describe('GET / (Root)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080');
    document = await response.json();
  });

	it('contains a `self` link', () => {
    expect(document._links.self).toEqual({
      href: '/'
    });
  });

  ['tasks', 'projects', 'users', 'departments'].forEach(name => {
    it(`contains Item and Collection links for '${name}'`, () => {
      expect(document._links[name]).toContainEqual({
        name: 'item',
        href: `/${name}/{id}`,
        templated: true
      });

      expect(document._links[name]).toContainEqual({
        name: 'collection',
        href: `/${name}{?where,page,order}`,
        templated: true
      });
    });

    it(`contains Create, Update and Delete forms for '${name}'`, () => {
      expect(document._forms[name]).toEqual([{
        name: 'create',
        href: `/${name}`,
        method: 'POST',
        schema: schemas[name],
      }, {
        name: 'update',
        href: `/${name}/{id}`,
        templated: true,
        method: 'PATCH',
        schema: {
          ...schemas[name],
          required: []
        }
      }, {
        name: 'delete',
        href: `/${name}/{id}`,
        templated: true,
        method: 'DELETE'
      }]);
    });
  });
});

describe('GET /departments/2 (ReadItem)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/departments/2');
    document = await response.json();
  });

  it('contains a `self` link', () => {
    expect(document._links.self).toEqual({
      href: '/departments/2'
    });
  });

  it('contains a collection link to related Users', () => {
    expect(document._links.users).toEqual({
      href: '/users?where=department,2',
      name: 'collection'
    });
  });

  it('contains Update and Delete forms', () => {
    expect(document._forms.departments).toEqual([{
      name: 'update',
      href: '/departments/2',
      method: 'PATCH',
      schema: jasmine.anything()
    }, {
      name: 'delete',
      href: '/departments/2',
      method: 'DELETE'
    }]);
  });

  it('populates `schema.default` and empties `required` in Update form', () => {
    var form = document._forms.departments.find(form => form.name === 'update');

    expect(form.schema).toEqual({
      ...schemas.departments,
      required: [],
      default: {
        id: 2,
        name: 'Marketing'
      }
    });
  });

  it('contains properties', () => {
    var properties = getProperties(document);
    expect(properties).toEqual({
      id: 2,
      name: 'Marketing'
    });
  });
});

describe('GET /departments/100 (ReadItem with invalid ID)', () => {
  it('responds with a 404 status code', async () => {
    var response = await fetch('http://localhost:8080/departments/100');
    var body = await response.json();
    expect(response.status).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found'
    })
  });
});

describe('GET /tasks/2 (ReadItem)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks/2');
    document = await response.json();
  });

  it('embeds parent Project and User documents identically to directly accessed documents', async () => {
    var [user, project] = await Promise.all([
      fetch('http://localhost:8080/users/2'),
      fetch('http://localhost:8080/projects/2')
    ]).then(responses => Promise.all(
      responses.map(response => response.json())
    ));

    expect(document._embedded).toEqual({
      users: user,
      projects: project
    });
  });
});

describe('GET /tasks (ReadCollection)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks');
    document = await response.json();
  });

  it('contains links to self, next and last page', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks'},
      next: {href: '/tasks?page=2'},
      last: {href: '/tasks?page=5'}
    });
  });

  it('contains Create form', () => {
    expect(document._forms).toEqual({
      tasks: {
        name: 'create',
        href: '/tasks',
        method: 'POST',
        schema: schemas.tasks
      }
    });
  });

  it('contains `count` property', () => {
    var properties = getProperties(document);
    expect(properties).toEqual({
      count: 100
    });
  });

  it('embeds each Task indentically to directly accessed documents', async () => {
    expect(document._embedded).toEqual({
      tasks: jasmine.any(Array)
    });

    await Promise.all(document._embedded.tasks.map(async embeddedTask => {
      var response = await fetch(`http://localhost:8080${embeddedTask._links.self.href}`);
      var task = await response.json();

      expect(task).toEqual(embeddedTask);
    }));
  });

  it('limits number of embedded documents to `pageSize`', () => {
    expect(document._embedded.tasks.length).toBe(20);
  });
});

describe('GET /tasks?page=3 (ReadCollection - 3rd Page)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?page=3');
    document = await response.json();
  });

  it('contains links to self, first, previous, next, and last page', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?page=3'},
      first: {href: '/tasks?page=1'},
      prev: {href: '/tasks?page=2'},
      next: {href: '/tasks?page=4'},
      last: {href: '/tasks?page=5'}
    });
  });

  it('limits and offsets embedded documents', () => {
    expect(document._embedded.tasks.length).toBe(20);
    expect(document._embedded.tasks[0].id).toBe(41);
  });
});

describe('GET /tasks?page=5 (ReadCollection - 5th page)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?page=5');
    document = await response.json();
  });

  it('contains links to self, first, and previous page', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?page=5'},
      first: {href: '/tasks?page=1'},
      prev: {href: '/tasks?page=4'}
    });
  });
});

describe('GET /tasks?where=owner,1 (ReadCollection - Conditions)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?where=owner,1');
    document = await response.json();
  });

  it('merges current conditions with pagination links', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?where=owner,1'},
      next: {href: '/tasks?where=owner,1&page=2'},
      last: {href: '/tasks?where=owner,1&page=3'}
    });
  });

  it('applies conditions to query', () => {
    expect(document.count).toBe(46);
  });
});

describe('GET /tasks?where=owner,1&page=2 (ReadCollection - Conditions - 2nd Page)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?where=owner,1&page=2');
    document = await response.json();
  });

  it('merges current conditions with pagination links', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?where=owner,1&page=2'},
      first: {href: '/tasks?where=owner,1&page=1'},
      prev: {href: '/tasks?where=owner,1&page=1'},
      next: {href: '/tasks?where=owner,1&page=3'},
      last: {href: '/tasks?where=owner,1&page=3'}
    });
  });

  it('offsets embedded documents', () => {
    expect(document._embedded.tasks[0].id).toBe(45);
  });
});

describe('GET /tasks?order=id,desc (ReadCollection - Order)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?order=id,desc');
    document = await response.json();
  });

  it('merges order with pagination links', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?order=id,desc'},
      next: {href: '/tasks?page=2&order=id,desc'},
      last: {href: '/tasks?page=5&order=id,desc'}
    });
  });

  it('orders by field in appropriate direction', () => {
    expect(document._embedded.tasks[0].id).toBe(100);
  });
});

describe('GET /tasks?order=id,desc&page=2 (ReadCollection - Order - 2nd Page)', () => {
  var document;

  beforeAll(async () => {
    var response = await fetch('http://localhost:8080/tasks?order=id,desc&page=2');
    document = await response.json();
  });

  it('merges order with pagination links', () => {
    expect(document._links).toEqual({
      self: {href: '/tasks?page=2&order=id,desc'},
      first: {href: '/tasks?page=1&order=id,desc'},
      prev: {href: '/tasks?page=1&order=id,desc'},
      next: {href: '/tasks?page=3&order=id,desc'},
      last: {href: '/tasks?page=5&order=id,desc'}
    });
  });
});

describe('POST /tasks (CreateItem)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task',
        owner: 1,
        project: 1
      })
    });
  });

  it('responds with a 201 status code', () => {
    expect(response.status).toBe(201);
  });

  it('references created Task in `Location` response header', () => {
    expect(response.headers.get('Location')).toEqual('/tasks/101');
  });

  it('contains an empty response body', async () => {
    var body = await response.text();
    expect(body).toEqual('');
  });

  it('creates the Task with given payload', async () => {
    var response = await fetch('http://localhost:8080/tasks/101');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 101,
      title: 'Test Task',
      complete: false,
      description: null,
      owner: 1,
      project: 1
    });
  });
});

describe('POST /tasks (CreateItem - Invalid Data)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        project: 1
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('contains validation errors', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '',
      schemaPath: '/required/0',
      message: 'Missing required property: title',
      params: {key: 'title'}
    }, {
      dataPath: '',
      schemaPath: '/required/2',
      message: 'Missing required property: owner',
      params: {key: 'owner'}
    }]);
  });

  it('does not create the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(101);
  });
});

describe('POST /tasks (CreateItem - Constraint violation)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task Two',
        owner: 1,
        project: 10
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('presents constraint violation as schema error', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/project',
      schemaPath: '/properties/project/constraint',
      message: 'Constraint violation'
    }]);
  });

  it('does not create the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(101);
  });
});

describe('POST /tasks (CreateItem - embedded Project)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task w/ new Project',
        owner: 1,
        project: {
          name: 'Test Project'
        }
      })
    });
  });

  it('responds with a 201 status code', () => {
    expect(response.status).toBe(201);
  });

  it('references created Task in `Location` response header', () => {
    expect(response.headers.get('Location')).toEqual('/tasks/103');
  });

  it('contains an empty response body', async () => {
    var body = await response.text();
    expect(body).toEqual('');
  });

  it('creates the Task with given payload', async () => {
    var response = await fetch('http://localhost:8080/tasks/103');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 103,
      title: 'Test Task w/ new Project',
      complete: false,
      description: null,
      owner: 1,
      project: 4
    });
  });

  it('creates the Project with the given payload', async () => {
    var response = await fetch('http://localhost:8080/projects/4');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 4,
      name: 'Test Project'
    });
  });
});

describe('POST /tasks (CreateItem - Embedded Project, User and Department)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task w/ new Project, User and Department',
        owner: {
          username: 'testUser',
          password: 'testUserHashedPassword',
          department: {
            name: 'Test Department'
          }
        },
        project: {
          name: 'Test Project Two'
        }
      })
    });
  });

  it('responds with a 201 status code', () => {
    expect(response.status).toBe(201);
  });

  it('references created Task in `Location` response header', () => {
    expect(response.headers.get('Location')).toEqual('/tasks/104');
  });

  it('contains an empty response body', async () => {
    var body = await response.text();
    expect(body).toEqual('');
  });

  it('creates the Task with given payload', async () => {
    var response = await fetch('http://localhost:8080/tasks/104');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 104,
      title: 'Test Task w/ new Project, User and Department',
      complete: false,
      description: null,
      owner: 7,
      project: 5
    });
  });

  it('creates the Project with the given payload', async () => {
    var response = await fetch('http://localhost:8080/projects/5');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 5,
      name: 'Test Project Two'
    });
  });

  it('creates the User with the given payload', async () => {
    var response = await fetch('http://localhost:8080/users/7');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 7,
      username: 'testUser',
      password: jasmine.any(String),
      enabled: true,
      department: 4
    });
  });

  it('creates the Department with the given payload', async () => {
    var response = await fetch('http://localhost:8080/departments/4');
    var newTask = await response.json();
    var properties = getProperties(newTask);

    expect(properties).toEqual({
      id: 4,
      name: 'Test Department'
    });
  });
});

describe('POST /tasks (CreateItem - Invalid embedded Project)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task w/ invalid Project',
        owner: 1,
        project: {
          title: 'Used `title` instead of `name`'
        }
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('contains all validation errors', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/project',
      message: 'Data does not match any schemas from "oneOf"',
      params: {},
      schemaPath: '/properties/project/oneOf',
      subErrors: [{
        dataPath: '/project',
        message: 'Invalid type: object (expected integer)',
        schemaPath: '/properties/project/oneOf/0/type',
        params: {
          expected: 'integer',
          type: 'object'
        }
      }, {
        dataPath: '/project',
        message: 'Missing required property: name',
        schemaPath: '/properties/project/oneOf/1/required/0',
        params: {
          key: 'name'
        }
      }]
    }]);
  });

  it('does not create the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(103);
  });

  it('does not create the Project', async () => {
    var response = await fetch('http://localhost:8080/projects');
    var {count} = await response.json();

    expect(count).toBe(5);
  });
});

describe('POST /tasks (CreateItem - Embedded User constraint violation)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task w/ invalid Project',
        project: 1,
        owner: {
          username: 'invalidTestUser',
          password: 'invalidTestUserHashedPassword',
          department: 55
        }
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('reports a nested constraint violation', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/department',
      schemaPath: '/properties/department/constraint',
      message: 'Constraint violation'
    }]);
  });

  it('does not create the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(103);
  });

  it('does not create the User', async () => {
    var response = await fetch('http://localhost:8080/users');
    var {count} = await response.json();

    expect(count).toBe(7);
  });
});

describe('PATCH /tasks/2 (UpdateItem - Valid data)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Modified Task 2'
      })
    });
  });

  it('responds with a 204 status code', () => {
    expect(response.status).toBe(204);
  });

  it('contains an empty body', async () => {
    var body = await response.text();
    expect(body).toBe('');
  });

  it('modifies the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks/2');
    var task = await response.json();
    var properties = getProperties(task);

    expect(properties).toEqual({
      id: 2,
      title: 'Modified Task 2',
      description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
      complete: true,
      project: 2,
      owner: 2
    });
  });

  it('does not modify other tasks', async () => {
    var response = await fetch('http://localhost:8080/tasks?where=title,Modified Task 2');
    var {count} = await response.json();
    expect(count).toBe(1);
  });
});

describe('PATCH /tasks/2 (UpdateItem - Invalid data)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 22
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('contains all validation errors', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/title',
      message: 'Invalid type: number (expected string)',
      params: {
        expected: 'string',
        type: 'number'
      },
      schemaPath: '/properties/title/type'
    }]);
  });

  it('does not modify any fields', async () => {
    var request = await fetch('http://localhost:8080/tasks/2');
    var task = await request.json();
    var properties = getProperties(task);

    expect(properties).toEqual({
      id: 2,
      title: 'Modified Task 2',
      description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
      complete: true,
      project: 2,
      owner: 2
    })
  });
});

describe('PATCH /tasks/2 (UpdateITem - Constraint Violation)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Set project to non-existent ID',
        project: 10
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('contains all validation errors', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/project',
      message: 'Constraint violation',
      schemaPath: '/properties/project/constraint'
    }]);
  })

  it('does not modify the Task', async () => {
    var request = await fetch('http://localhost:8080/tasks/2');
    var task = await request.json();
    var properties = getProperties(task);

    expect(properties).toEqual({
      id: 2,
      title: 'Modified Task 2',
      description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
      complete: true,
      project: 2,
      owner: 2
    })
  });
});

describe('PATCH /tasks/2 (UpdateItem - Embedded Project)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Set to new Project',
        project: {
          name: 'Test Project Three'
        }
      })
    });
  });

  it('responds with a 204 status code', () => {
    expect(response.status).toBe(204);
  });

  it('contains an empty body', async () => {
    var body = await response.text();
    expect(body).toBe('');
  });

  it('modifies the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks/2');
    var task = await response.json();
    var properties = getProperties(task);

    expect(properties).toEqual({
      id: 2,
      title: 'Set to new Project',
      complete: true,
      description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
      owner: 2,
      project: 6
    });
  });

  it('creates the Project', async () => {
    var response = await fetch('http://localhost:8080/projects/6');
    var project = await response.json();
    var properties = getProperties(project);

    expect(properties).toEqual({
      id: 6,
      name: 'Test Project Three',
    });
  });
});

describe('PATCH /tasks/2 (UpdateItem - Invalid embedded Project)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Set to new Project Two',
        project: {
          title: 'Used `title` instead of `name`'
        }
      })
    });
  });

  it('responds with a 422 status code', () => {
    expect(response.status).toBe(422);
  });

  it('contains all validation errors', async () => {
    var body = await response.json();

    expect(body.errors).toEqual([{
      dataPath: '/project',
      message: 'Data does not match any schemas from "oneOf"',
      schemaPath: '/properties/project/oneOf',
      params: {},
      subErrors: [{
        dataPath: '/project',
        message: 'Invalid type: object (expected integer)',
        schemaPath: '/properties/project/oneOf/0/type',
        params: {
          expected: 'integer',
          type: 'object'
        }
      }, {
        dataPath: '/project',
        message: 'Missing required property: name',
        schemaPath: '/properties/project/oneOf/1/required/0',
        params: {
          key: 'name'
        }
      }]
    }]);
  });

  it('does not modify the Task', async () => {
    var request = await fetch('http://localhost:8080/tasks/2');
    var task = await request.json();
    var properties = getProperties(task);

    expect(properties).toEqual({
      id: 2,
      title: 'Set to new Project',
      description: "I'll parse the digital USB bandwidth, that should pixel the FTP transmitter!",
      complete: true,
      project: 6,
      owner: 2
    })
  });
});

describe('DELETE /tasks/2 (DeleteItem)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'DELETE',
    });
  });

  it('responds with a 204 status code', () => {
    expect(response.status).toBe(204);
  });

  it('contains an empty body', async () => {
    var body = await response.text();
    expect(body).toBe('');
  });

  it('deletes the Task', async () => {
    var response = await fetch('http://localhost:8080/tasks/2');
    expect(response.status).toBe(404);
  });

  it('does not delete any other Tasks', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(102);
  });
});

describe('DELETE /tasks/200 (DeleteItem with invalid ID)', () => {
  var response: Response;

  beforeAll(async () => {
    response = await fetch('http://localhost:8080/tasks/2', {
      method: 'DELETE',
    });
  });

  it('responds with a 404 status code', async () => {
    expect(response.status).toBe(404);

    var body = await response.json();

    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found'
    })
  });

  it('does not delete any Tasks', async () => {
    var response = await fetch('http://localhost:8080/tasks');
    var {count} = await response.json();

    expect(count).toBe(102);
  });
});
