import CreateItem from '../CreateItem';
import * as schema from '../../schema';
import * as resource from '../../__mocks__/resource';

import {Request} from 'hapi';

var createItem: CreateItem;
var request = {
  payload: {
    test: 'data'
  }
} as any as Request;

beforeEach(() => {
  createItem = new CreateItem(resource.tasks);
});

it('is a POST request to `{resourceName}`', () => {
  expect(createItem.method).toBe('POST');
  expect(createItem.path).toBe('tasks');
});

describe('#handle()', () => {
  it('validates request payload against resource schema', async () => {
    spyOn(schema, 'validate').and.callThrough();

    await createItem.handle({}, request);

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
      }],
      data: request.payload
    });
  });
});
