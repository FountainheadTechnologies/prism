import Action, {Params} from 'prism/action';
import Document from 'prism/document';

import {Request} from 'hapi';

export default class Root implements Action {
  path = '';

  method = 'GET';

  handle = () => ({})

  decorate = (doc: Document): Document => doc
}
