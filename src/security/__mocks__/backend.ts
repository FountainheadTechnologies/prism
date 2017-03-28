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
    type: Function,
    method: "someFunction",
    filter: jest.fn()
  }]
} as Backend;
