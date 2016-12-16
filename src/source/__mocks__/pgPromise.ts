import {resolve} from 'bluebird';
import {IDatabase} from 'pg-promise';

export default {
  oneOrNone:  jest.fn(() => resolve({
    name: 'mockOneOrNoneResult'
  })),
  manyOrNone: jest.fn(() => resolve([{
    name: 'mockManyOrNoneResult1'
  }, {
    name: 'mockManyOrNoneResult2'
  }])),
  one: jest.fn(() => resolve({
    count: '2'
  }))
} as any as IDatabase<{}>;
