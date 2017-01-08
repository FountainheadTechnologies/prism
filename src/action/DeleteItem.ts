import Action, {Params, Filter} from '../action';
import ReadItem from './ReadItem';
import Root from './Root';
import Resource from '../resource';
import * as query from '../query';

import * as Promise from 'bluebird';
import {Request, Response} from 'hapi';
import {pathEq} from 'ramda';

export default class DeleteItem implements Action {
  path: string;

  method = 'DELETE';

  constructor(readonly resource: Resource) {
    var keys = this.resource.primaryKeys.map(key => `{${key}}`);
    this.path = [this.resource.name, ...keys].join('/');
  }

  handle = (params: Params, request: Request): Promise<Response> =>
    this.resource.source
      .delete(this.query(params, request))
      .then(() => {
        var response = (request as any).generateResponse();
        response.code(204);

        return response;
      });

  query = (params: Params, request: Request): query.Delete => ({
    conditions: this.conditions(params, request),
    source: this.resource.name
  });

  conditions = (params: Params, request: Request): query.Condition[] =>
    this.resource.primaryKeys.map(key => ({
      field: key,
      value: params[key]
    }));

  filters = [
    /**
     * Register a form for this action in the root document
     */
    <Filter<Root, 'decorate'>>{
      type: Root,
      name: 'decorate',
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: 'delete',
          method: this.method
        });

        return doc;
      }
    },

    /**
     * Register a form for this action on item documents
     */
    <Filter<ReadItem, 'decorate'>>{
      type: ReadItem,
      name: 'decorate',
      where: pathEq(['resource', 'name'], this.resource.name),
      filter: next => (doc, params, request) => {
        next(doc, params, request);

        doc.forms.push({
          rel: this.resource.name,
          href: this.path,
          name: 'delete',
          params: doc.properties,
          method: this.method
        });

        return doc;
      }
    }
  ]
}
