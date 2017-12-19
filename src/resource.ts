import { Source } from "./source";
import { Schema } from "./schema";
import { defaultsDeep, clone } from "lodash";

/**
 * Defines a relationship between two resources
 */
export interface Relationship {
  /**
   * The name of the related resources
   */
  name: string;

  /**
   * The name of the identifying property in *this* resource, ie the 'foreign key'
   */
  from: string;

  /**
   * The name of the identifying property in the *related* resource, ie the
   * 'primary key'
   */
  to: string;
}

export interface Resource {
  source: Source;
  name: string;
  schema: Schema;
  primaryKeys: string[];

  relationships: {
    belongsTo: Relationship[];
    has: Relationship[];
  };
}

/**
 * Options to control the checking and building of a Resource object
 */
export interface Options {
  /**
   * If `true`, require that the input Resource object contains at least one
   * `primaryKey`
   */
  requirePK: boolean;
}

const DEFAULT_RESOURCE: Partial<Resource> = {
  schema: {
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {},
    required: [],
    title: ""
  },

  primaryKeys: [],

  relationships: {
    belongsTo: [],
    has: []
  }
};

const DEFAULT_OPTIONS: Options = {
  requirePK: true
};

/**
 * Initialize a `resource` object to ensure that it contains all required
 * properties. This allows Actions to avoid verbose checks and guards when a
 * user defines a `minimal` configuration.
 *
 * @param resource A partial resource definition. Must contain at least `name`
 * and `source` in any case, and at least one `primaryKey` if
 * `options.requirePK` is `true`
 * @param options Options to use when checking and building the Resource object
 * @return A fully defined Resource object
 */
export const initialize = (resource: Partial<Resource>, options: Partial<Options> = {}): Resource => {
  options = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  if (!resource.name || !resource.source) {
    throw Error("`resource.name` and `resource.source` must be specified");
  }

  if (options.requirePK && (!resource.primaryKeys || !resource.primaryKeys.length)) {
    throw Error("`resource.primaryKeys` must specify at least one primary key");
  }

  let schema: Schema = {
    ...DEFAULT_RESOURCE.schema as Schema,
    title: resource.name
  };

  return defaultsDeep(clone(resource), { schema }, DEFAULT_RESOURCE) as Resource;
};
