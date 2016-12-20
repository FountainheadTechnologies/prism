import {Server} from 'hapi';

export default {
  expose: jest.fn(),
  route:  jest.fn(),
  log:    jest.fn(),
  connections: []
} as any as Server;
