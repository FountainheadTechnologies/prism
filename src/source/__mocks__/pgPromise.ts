import { IDatabase } from "pg-promise";

export const db = {
  oneOrNone: jest.fn(() => Promise.resolve({
    name: "mockOneOrNoneResult"
  })),
  manyOrNone: jest.fn(() => Promise.resolve([{
    name: "mockManyOrNoneResult1"
  }, {
    name: "mockManyOrNoneResult2"
  }])),
  one: jest.fn(() => Promise.resolve({
    count: "2"
  })),
  result: jest.fn(() => Promise.resolve({
    rowCount: 2
  }))
} as any as IDatabase<{}>;
