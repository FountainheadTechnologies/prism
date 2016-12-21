import {Item, Collection} from './types';

import * as Promise from 'bluebird';

interface Schema {
  $schema: string;
  title: string;
  type: string;
  properties: Object;
  required: string[];
}

export default Schema;

export const validate = (data: Item | Collection, schema: Schema): Promise<boolean> =>
  Promise.resolve(true);

export const sanitize = <T extends Item | Collection>(data: T, schema: Schema): T =>
  data;
