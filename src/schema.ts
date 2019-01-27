import { Item, Collection } from "./types";

import { validateMultiple } from "tv4";
import { badData, Payload } from "boom";
import { keys, pick } from "ramda";

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

type ValidationError =
  Pick<tv4.ValidationError, "message" | "dataPath" | "schemaPath"> &
  Partial<{
    subErrors: ValidationError[];
    params: {}
  }>;

export interface ValidationFailurePayload extends Payload {
  errors: ValidationError[];
}

export const validate = (data: Item | Collection, schema: Schema): Promise<boolean> =>
  new Promise((resolve, reject) => {
    let test = validateMultiple(data, schema);
    if (test.valid) {
      return resolve(true);
    }

    const sanitize = (error: tv4.ValidationError): ValidationError => {
      let result = pick(["message", "params", "dataPath", "schemaPath"], error) as ValidationError;

      if (error.subErrors) {
        result.subErrors = error.subErrors.map(sanitize);
      }

      return result;
    };

    let error = badData("Schema validation failed");
    (error.output.payload as ValidationFailurePayload).errors = test.errors.map(sanitize);

    return reject(error);
  });

export const sanitize = <T extends Item | Collection>(data: T, schema: Schema): T =>
  data;

export const pickAllowedValues = (schema: Schema, values: Object) => {
  let allowed = keys(schema.properties)
    .filter(key => !schema.properties[key].readOnly);

  return pick(allowed, values);
};
