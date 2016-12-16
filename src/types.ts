export interface Item {
  [key: string]: any
}

export interface Collection {
  count: number;
  items: Item[]
}
