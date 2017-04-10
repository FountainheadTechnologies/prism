import { Source } from "../source";

export const source = {
  create: jest.fn(),
  read: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
} as Source;
