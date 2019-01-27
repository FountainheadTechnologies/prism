import { Request, ResponseObject } from "hapi";

export const response = {
  code: jest.fn(),
  location: jest.fn(),
  plugins: {}
} as any as ResponseObject;

export const request = {
  auth: {},
  generateResponse: jest.fn().mockReturnValue(response)
} as any as Request;
