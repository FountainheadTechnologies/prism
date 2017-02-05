import Source from "./source";
import Schema from "./schema";

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

interface Resource {
  source: Source;
  name:   string;
  schema: Schema;
  primaryKeys: string[];

  relationships: {
    belongsTo: Relationship[];
    has: Relationship[];
  };
}

export default Resource;
