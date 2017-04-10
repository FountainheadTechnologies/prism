import { Params } from "./action";
import { Schema } from "./schema";

import { Request } from "hapi";
import { clone, pick } from "ramda";
import * as uriTpl from "uri-templates";

export type Properties = {
  [key: string]: any
};

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
  };
  public?: boolean;
  private?: boolean;
}

export interface RenderedLink {
  href: string;
  name?: string;
  templated?: boolean;
}

export interface Form extends Link {
  method: string;
  schema?: Schema;
}

export interface RenderedForm extends RenderedLink {
  method: string;
  schema?: Schema;
}

export class Document {
  embedded: Embed[] = [];

  links: Link[] = [];

  forms: Form[] = [];

  constructor(public properties: Properties = {}) { }

  render(params: Params, request: Request) {
    let result = clone(this.properties);

    this.embedded.forEach(embed => {
      let _embedded = embed.document.render(params, request);
      upsert(result, "_embedded", embed.rel, _embedded, embed.alwaysArray);
    });

    this.links
      .filter(link => isVisible(request, link))
      .forEach(link => {
        let _link = renderLink(link);
        upsert(result, "_links", link.rel, _link);
      });

    this.forms
      .filter(form => isVisible(request, form))
      .forEach(form => {
        let _form = renderForm(form);
        upsert(result, "_forms", form.rel, _form);
      });

    return result;
  }
}

const isVisible = (request: Request, item: Link | Form): boolean => {
  if (request.auth.error === null) {
    return item.private !== false;
  }

  return item.public === true;
};

const renderLink = (link: Link): RenderedLink => {
  let _link = pick<Link, RenderedLink>(["href", "name"], link);
  let isTemplated = link.href.indexOf("{") > -1;

  if (!isTemplated) {
    return _link;
  }

  if (!link.params) {
    return {
      ..._link,
      templated: true
    };
  }

  return {
    ..._link,
    href: uriTpl(link.href).fillFromObject(link.params)
  };
};

const renderForm = (form: Form): RenderedForm => ({
  ...renderLink(form),
  method: form.method,
  schema: form.schema
});

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
};
