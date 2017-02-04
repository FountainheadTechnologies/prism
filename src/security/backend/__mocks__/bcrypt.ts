import {resolve} from "bluebird";

const _hash = (input: string) =>
  resolve(`hashed:${input}`);

const _compare = (given: string, actual: string, cb: Function) =>
  cb(null, actual === `hashed:${given}`);

export const hash = jest.fn().mockImplementation(_hash);
export const compare = jest.fn().mockImplementation(_compare);
