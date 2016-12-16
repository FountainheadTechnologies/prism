import Schema from 'prism/schema';

export interface Condition {
  field: string;
  value: any;
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
  schema: Schema;
}

export interface Create extends Query {
  returning: string[];
  joins?: Join[];
  data: any;
}

export interface Read extends Query {
  fields?: string[];
  conditions?: Condition[];
  joins?: Join[];
  order?: Order[];
  page?: Page;
  return: 'collection' | 'item';
}

export interface Update extends Query {
  conditions?: Condition[];
  returning: string[];
  joins?: Join[];
  data: any;
}

export interface Delete extends Query {
  conditions?: Condition[];
}
