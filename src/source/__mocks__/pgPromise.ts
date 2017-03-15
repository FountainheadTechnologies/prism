import {resolve} from "bluebird";
import {IDatabase} from "pg-promise";

export const db = {
  oneOrNone:  jest.fn(() => resolve({
    name: "mockOneOrNoneResult"
  })),
  manyOrNone: jest.fn(() => resolve([{
    name: "mockManyOrNoneResult1"
  }, {
    name: "mockManyOrNoneResult2"
  }])),
  one: jest.fn(() => resolve({
    count: "2"
  })),
  result: jest.fn(() => resolve({
    rowCount: 2
  }))
} as any as IDatabase<{}>;
