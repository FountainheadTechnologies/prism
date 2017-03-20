/**
 * Defines the 'Document' class and interfaces to support the generation of
 * response data according to HAL semantics
 * @module Document
 */

/**
 * required by typedoc-plugin-external-module-name
 */

import {Params} from "./action";
import {Schema} from "./schema";

import {Request} from "hapi";
import {clone, pick} from "ramda";
import * as uriTpl from "uri-templates";

/**
 * The 'state' of a Document, ie its properties. These properties are typically
 * 'real' keys and values returned from a resource query.
 */
export type Properties = {
  [key: string]: any
};

/**
 * Represents a Document embedded within a Document. Embedded documents
 * typically contain a 'parent' Document that was inferred by the relationship
 * between resource definitions.
 */
export interface Embed {
  /**
   * The 'relname' of this embedded Document. Determines the key under
   * `_embedded` where this Document will be rendered. If multiple embeds with
   * the same `rel` exist on a Document, they will be presented as an Array
   * instead.
   */
  rel: string;

  /**
   * The Document to be embedded.
   */
  document: Document;

  /**
   * Force this embed to be rendered as an array, even if it is the only embed
   * with that relname, by explicitly setting `alwaysArray` to `true`.
   */
  alwaysArray?: boolean;
}

/**
 * Represents a hyperlink to another document
 */
export interface Link {
  /**
   * The 'relname' of the link. Determines the key under `_links` where this
   * link will be rendered. If a document contains multiple links with the same
   * `rel`, they will be rendered as an Array instead.
   */
  rel: string;

  /**
   * A URI or URI Template that this link refers to.
   */
  href: string;

  /**
   * Used for disambiguating multiple links with the same `rel`.
   */
  name?: string;

  /**
   * If `href` is a URI Template, then the values of `params` will be used to
   * 'fill' the template when this Link is rendered.
   */
  params?: {
    [key: string]: any
  };

  /**
   * If Authentication is enabled but the request does not contain valid
   * authentcation credentials, allow this Link to be rendered by explicitly
   * setting to `true`
   */
  public?: boolean;

  /**
   * If Authentication is enabled and the request contains valid authentication
   * credentials, allow this Link to be hidden by explicitly setting to `false`
   */
  private?: boolean;
}

/**
 * The rendered representation of a Link
 */
export interface RenderedLink {
  /**
   * A URI or URI Template that this link refers to. If a URI template, then
   * `templated` must be `true`.
   */
  href: string;

  /**
   * Used for disambiguating multiple links with the same `rel`.
   */
  name?: string;

  /**
   * If `true`, indicates that `href` is a URI Template and requires parameter
   * substitution in order to be valid.
   */
  templated?: boolean;
}

/**
 * Represents a 'form control' that may be used to mutate documents
 */
export interface Form extends Link {
  /**
   * The HTTP method to use when executing this Form
   */
  method: string;

  /**
   * The JSON schema that will be used to validate any data supplied in the
   * request body.
   */
  schema?: Schema;
}

/**
 * The rendered representation of a Form
 */
export interface RenderedForm extends RenderedLink {
  /**
   * The HTTP method to use when executing this Form
   */
  method: string;

  /**
   * The JSON schema that will be used to validate any data supplied in the
   * request body.
   */
  schema?: Schema;
}

/**
 * A Document instance acts as a container for Properties, Links, Embeds and
 * Forms. Once of all of the requisite data has been loaded into the container,
 * it may be 'rendered' as a HAL document which can be sent as an HTTP response.
 */
export class Document {
  /**
   * Embedded documents which will be rendered recursively.
   */
  embedded: Embed[] = [];

  /**
   * Link definitions which will be rendered under the `_links` property of the
   * rendered document
   */
  links: Link[] = [];

  /**
   * Form definitions which will be rendered under the `_forms` property of the
   * rendered document
   */
  forms: Form[] = [];

  /**
   * @param properties An object containing the 'state' to initialize the
   * Document being constructed with
   */
  constructor(public properties: Properties = {}) {}

  /**
   * Creates a HAL-compliant document according to `properties`, `embedded`,
   * `links` and `forms`. Any embedded documents will be rendered recursively.
   */
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

/**
 * Determine if a Link or Form is visible based on the authentication state of
 * `request` and the value of `item.private` or `item.public`.
 */
const isVisible = (request: Request, item: Link | Form): boolean => {
  if (request.auth.error === null) {
    return item.private !== false;
  }

  return item.public === true;
};

/**
 * Transforms a Link into its rendered equivalent. If `link.href` is a URI
 * Template, then it will be populated according to `link.params`.
 *
 * If `link.params` is missing, then the template will be displayed without
 * parameter substitution and `templated` will be set to `true`.
 */
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

/**
 * Transforms a Form into its rendered equivalent. Delegates to `renderLink`,
 * with the added support for `method` and `schema` properties.
 */
const renderForm = (form: Form): RenderedForm => ({
  ...renderLink(form),
  method: form.method,
  schema: form.schema
});

/**
 * Performs an 'upsert' operation against `object.key.name`.
 *
 * - If `object.key.name` does not exist, it is created and set to `value`. If
 * `alwaysArray` is `true`, then `value` is wrapped in an Array first.
 * - If `object.key.name` exists, it is converted to an Array and then `value` is appended
 * - If `object.key.name` exists and is an array, `value` is appended
 */
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
