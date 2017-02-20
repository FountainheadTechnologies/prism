import {Schema} from "./schema";

export interface Raw {
  $raw: {
    fragment: any;
    values?: any[];
  };
}

export type Field = string | Raw;

export type Condition = ConditionAnd | ConditionOr | ConditionTerm | Raw;

export interface ConditionAnd {
  $and: Condition[];
}

export interface ConditionOr {
  $or: Condition[];
}

export interface ConditionTerm {
  field: string;
  value: any;
  operator?: string;
}

export interface Join {
  source: string;
  path: string[];
  from: string;
  to: string;
}

export interface Order {
  field: string;
  direction: string;
}

export interface Page {
  size: number;
  number: number;
}

export interface Query {
  source: string;
}

export interface Create extends Query {
  returning: string[];
  schema: Schema;
  joins?: Join[];
  data: any;
}

export interface Read extends Query {
  fields?: Field[];
  conditions?: Condition[];
  schema: Schema;
  joins?: Join[];
  order?: Order[];
  page?: Page;
  return: "collection" | "item";
}

export interface Update extends Query {
  conditions?: Condition[];
  returning: string[];
  schema: Schema;
  joins?: Join[];
  data: any;
}

export interface Delete extends Query {
  conditions?: Condition[];
}
