import Action, {Params, Filter} from '../action';
import ReadCollection from './ReadCollection';
import Root from './Root';
import Resource from '../resource';
import {Item} from '../types';
import Schema, {validate, sanitize} from '../schema';
import * as query from '../query';

import * as Promise from 'bluebird';
import {Request} from 'hapi';

export default class CreateItem implements Action {
  path: string;

  method = 'POST';

  constructor(readonly resource: Resource) {
    this.path = this.resource.name;
  }

  handle = (params: Params, request: Request): Promise<Item> => {
    var schema = this.schema(params, request);
    var source = this.resource.source;

    return validate(request.payload, schema)
      .then(() => source.create(this.query(params, request)));
  }

  schema = (params: Params, request: Request): Schema =>
    this.resource.schema;

  query = (params: Params, request: Request): query.Create => ({
    returning: this.resource.primaryKeys,
    source: this.resource.name,
    schema: this.schema(params, request),
    joins:  this.joins(params, request),
    data:   request.payload
  });

  joins = (params: Params, request: Request): query.Join[] =>
    this.resource.relationships.belongsTo.map(parent => ({
      source: parent.name,
      path:   [parent.from],
      from:   parent.from,
      to:     parent.to
    }));
}
