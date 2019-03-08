import { Item, Collection } from "./types";

import * as Ajv from "ajv";
import { badData, Payload } from "boom";
import { always, keys, pick } from "ramda";
import { ErrorObject } from "ajv";

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

export interface ValidationFailurePayload extends Payload {
  errors: Ajv.ErrorObject[];
}

export const ajv = new Ajv({
  jsonPointers: true,
  allErrors: true
});

export const validate = (data: Item | Collection, schema: Schema): Promise<boolean> => {
  let valid = ajv.validate(schema, data);

  if (typeof valid === "boolean") {
    if (valid === true) {
      return Promise.resolve(true);
    }

    return rejectAsBoomError(ajv.errors!);
  }

  return (valid as Promise<any>)
    .then(always(true))
    .catch(error => rejectAsBoomError(error.errors));
};

const rejectAsBoomError = (errors: ErrorObject[]) => {
  let error = badData("Schema validation failed");
  (error.output.payload as ValidationFailurePayload).errors =
    errors.map<Ajv.ErrorObject>(pick(["message", "params", "dataPath", "schemaPath"]));

  return Promise.reject(error);
};

export const pickAllowedValues = (schema: Schema, values: Object) => {
  let allowed = keys(schema.properties)
    .filter(key => !schema.properties[key].readOnly);

  return pick(allowed, values);
};
