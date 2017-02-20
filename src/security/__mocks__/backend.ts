import {Backend} from "../backend";

export const backend = {
  issue: jest.fn(),
  validate: jest.fn(),
  schema: {
    $schema: "test",
    title: "test",
    type: "object",
    properties: {},
    required: []
  },
  filters: [{
    type: "mockFilter" as any,
    name: "someFunction",
    filter: jest.fn()
  }]
} as Backend;
