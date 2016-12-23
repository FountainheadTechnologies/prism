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
    test: 'data'
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

  beforeEach(() => {
    registry = new Registry();
    root = new Root();

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
});
