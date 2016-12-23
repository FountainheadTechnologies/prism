import Action, {Params} from '../action';
import Document from '../Document';

import {Request} from 'hapi';

export default class Root implements Action {
  path = '';

  method = 'GET';

  handle = () => ({})

  decorate = (doc: Document, params: Params, request: Request): Document =>
    doc
}
