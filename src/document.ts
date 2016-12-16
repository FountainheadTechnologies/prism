export type Properties = {
  [key: string]: any
}

export interface Embed {
  rel: string;
  document: Document;
}

export interface Link {
  rel: string;
  href?: string;
  name?: string;
  params?: {
    [key: string]: any
  }
}

export default class Document {
  embedded: Embed[] = [];

  links: Link[] = [];

  omit: string[] = [];

  constructor(public properties: Properties) {}
}
