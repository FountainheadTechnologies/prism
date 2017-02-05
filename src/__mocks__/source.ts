import Source from "../source";

export default {
  create: jest.fn(),
  read:   jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
} as Source;
