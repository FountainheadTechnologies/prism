interface Schema {
  $schema: string;
  title: string;
  type: string;
  properties: Object;
  required: string[];
}

export default Schema;
