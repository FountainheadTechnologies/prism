import { Item, Collection } from "./types";

import { validateMultiple } from "tv4";
import { badData } from "boom";
import { pick } from "ramda";

export interface Schema {
  $schema: string;
  title: string;
  type: string;
  properties: {
    [key: string]: any
  };
  required: string[];
  default?: any;
}

export const validate = (data: Item | Collection, schema: Schema): Promise<boolean> =>
  new Promise((resolve, reject) => {
    let test = validateMultiple(data, schema);
    if (test.valid) {
      return resolve(true);
    }

    const sanitize = (error: tv4.ValidationError): Object => {
      let result = pick(["message", "params", "dataPath", "schemaPath"], error);

      if (error.subErrors) {
        Object.assign(result, {
          subErrors: error.subErrors.map(sanitize)
        });
      }

      return result;
    };

    let error = badData();
    error.output.payload.errors = test.errors.map(sanitize);

    return reject(error);
  });

export const sanitize = <T extends Item | Collection>(data: T, schema: Schema): T =>
  data;
