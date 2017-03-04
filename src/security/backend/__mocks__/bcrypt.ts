const _hash = async (input: string) =>
  `hashed:${input}`;

const _compare = async (given: string, actual: string, cb: Function) =>
  actual === `hashed:${given}`;

export const hash = jest.fn().mockImplementation(_hash);
export const compare = jest.fn().mockImplementation(_compare);
