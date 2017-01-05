import CreateItem from '../CreateItem';
import Root from '../Root';
import Registry from '../../Registry';
import Document from '../../Document';
import * as schema from '../../schema';
import * as resource from '../../__mocks__/resource';

import {Request} from 'hapi';

var createTask: CreateItem;
var request = {
  payload: {
    title: 'New Test Task',
    owner: 1,
    project: 1
  }
} as any as Request;

beforeEach(() => {
  createTask = new CreateItem(resource.tasks);
});

it('is a POST request to `{resourceName}`', () => {
  expect(createTask.method).toBe('POST');
  expect(createTask.path).toBe('tasks');
});

describe('#handle()', () => {
  it('validates request payload against resource schema', async () => {
    spyOn(schema, 'validate').and.callThrough();

    await createTask.handle({}, request);

    expect(schema.validate).toHaveBeenCalledWith(request.payload, resource.tasks.schema);
    expect(resource.tasks.source.create).toHaveBeenCalledWith({
      returning: resource.tasks.primaryKeys,
      source: resource.tasks.name,
      schema: resource.tasks.schema,
      joins: [{
        from: 'owner',
        path: ['owner'],
        source: 'users',
        to: 'id'
      }, {
        from: 'project',
        path: ['project'],
        source: 'projects',
        to: 'id'
      }],
      data: request.payload
    });
  });
});

describe('#schema()', () => {
  it('returns resource schema', () => {
    expect(createTask.schema({}, request)).toBe(resource.tasks.schema);
  });
});

describe('filters', () => {
  var registry: Registry;
  var root: Root;
  var createUser: CreateItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    createUser = new CreateItem(resource.users);

    registry.registerAction(root);
    registry.registerAction(createTask);
  });

  it('registers a form on the Root action', () => {
    var document = new Document();
    root.decorate(document, {}, request);

    expect(document.forms).toEqual([{
      rel: resource.tasks.name,
      href: createTask.path,
      method: createTask.method,
      schema: resource.tasks.schema
    }]);
  });

  it('recursively joins itself as a parent on child queries', () => {
    registry.registerAction(createUser);

    var joins = createTask.joins({}, request);
    expect(joins).toEqual([{
      source: 'users',
      path: ['owner'],
      from: 'owner',
      to: 'id'
    }, {
      source: 'projects',
      path: ['project'],
      from: 'project',
      to: 'id'
    }, {
      source: 'departments',
      path: ['tasks', 'department'],
      from: 'department',
      to: 'id'
    }]);
  });

  it('embeds its schema into Create forms on related children', () => {
    registry.registerAction(createUser);

    var document = new Document();
    root.decorate(document, {}, request);

    expect(document.forms[0].schema).toEqual({
      ...resource.tasks.schema,
      properties: {
        ...resource.tasks.schema.properties,
        owner: {
          oneOf: [{
            type: 'integer'
          }, resource.users.schema]
        }
      }
    });
  });
});
