import {Item, Collection} from './types';

import {validateMultiple} from 'tv4';
import {badData} from 'boom';
import {pick} from 'ramda';
import * as Promise from 'bluebird';

interface Schema {
  $schema: string;
  title: string;
  type: string;
  properties: {
    [key: string]: any
  };
  required: string[];
}

export default Schema;

export const validate = (data: Item | Collection, schema: Schema): Promise<boolean> => {
  var test = validateMultiple(data, schema);
  if (test.valid) {
    return Promise.resolve(true);
  }

  const sanitize = (error: tv4.ValidationError): Object => {
    var result = pick(['message', 'params', 'dataPath', 'schemaPath'], error);

    if (error.subErrors) {
      Object.assign(result, {
        subErrors: error.subErrors.map(sanitize)
      });
    }

    return result;
  }

  var error = badData();
  error.output.payload.errors = test.errors.map(sanitize);

  return Promise.reject(error);
};

export const sanitize = <T extends Item | Collection>(data: T, schema: Schema): T =>
  data;
