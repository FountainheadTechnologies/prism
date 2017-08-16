export const departments = {
  $schema: "http://json-schema.org/draft-04/schema#",
  title: 'departments',
  type: 'object',
  properties: {
    id: { type: 'number', readOnly: true },
    name: { type: 'string' }
  },
  required: ['name']
};

export const users = {
  $schema: "http://json-schema.org/draft-04/schema#",
  title: 'users',
  type: 'object',
  properties: {
    id: { type: 'number', readOnly: true },
    username: { type: 'string' },
    password: { type: 'string' },
    enabled: { type: 'boolean' },
    department: {
      oneOf: [{
        type: 'number',
      }, departments]
    }
  },
  required: ['username', 'password', 'department']
};

export const projects = {
  $schema: "http://json-schema.org/draft-04/schema#",
  title: 'projects',
  type: 'object',
  properties: {
    id: { type: 'number', readOnly: true },
    name: { type: 'string' },
    tags: {}
  },
  required: ['name']
};

export const tasks = {
  $schema: "http://json-schema.org/draft-04/schema#",
  title: 'tasks',
  type: 'object',
  properties: {
    id: { type: 'number', readOnly: true },
    title: { type: 'string' },
    description: { type: 'string' },
    complete: { type: 'boolean' },
    project: {
      oneOf: [{
        type: 'number',
      }, projects]
    },
    owner: {
      oneOf: [{
        type: 'number',
      }, users]
    }
  },
  required: ['title', 'project']
};
