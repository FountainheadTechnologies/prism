import {Request, Response} from "hapi";

export const response = {
  code: jest.fn(),
  location: jest.fn(),
  plugins: {}
} as any as Response;

export const request = {
  generateResponse: jest.fn().mockReturnValue(response)
} as any as Request;
