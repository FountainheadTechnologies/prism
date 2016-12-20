import {Params} from './action';

import {Request} from 'hapi';
import {clone, pick} from 'ramda';
import * as uriTpl from 'uri-templates';

export type Properties = {
  [key: string]: any
}

export interface Embed {
  rel: string;
  document: Document;
  alwaysArray?: boolean;
}

export interface Link {
  rel: string;
  href: string;
  name?: string;
  params?: {
    [key: string]: any
  }
}

export interface RenderedLink {
  href: string;
  templated?: boolean;
  name?: string;
}

export default class Document {
  embedded: Embed[] = [];

  links: Link[] = [];

  constructor(public properties: Properties = {}) {}

  render(params: Params, request: Request) {
    var result = clone(this.properties);

    this.links.forEach(link => {
      var _link = renderLink(link);
      upsert(result, '_links', link.rel, _link);
    });

    this.embedded.forEach(embed => {
      var _embedded = embed.document.render(params, request);
      upsert(result, '_embedded', embed.rel, _embedded, embed.alwaysArray);
    });

    return result;
  }
}

const renderLink = (link: Link): RenderedLink => {
  var _link = pick<Link, RenderedLink>(['href', 'name'], link);
  var isTemplated = link.href.indexOf('{') > -1;

  if (!isTemplated) {
    return _link;
  }

  if (!link.params) {
    return {
      ..._link,
      templated: true
    }
  }

  return {
    ..._link,
    href: uriTpl(link.href).fillFromObject(link.params)
  };
}

const upsert = (object: Properties, key: string, name: string, value: Object, alwaysArray: boolean = false) => {
  if (!object[key]) {
    object[key] = {
      [name]: alwaysArray ? [value] : value
    };

    return;
  }

  if (!object[key][name]) {
    object[key][name] = alwaysArray ? [value] : value;
    return;
  }

  if (object[key][name] instanceof Array) {
    object[key][name].push(value);
    return;
  }

  object[key][name] = [object[key][name]].concat(value);
}
