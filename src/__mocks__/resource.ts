import Resource from 'prism/resource';

export const tasks = {
  name: 'tasks',
  source: require('data/source'),
  schema: {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'tasks',
    type: 'object',
    properties: {
      id: {type: 'integer'},
      title: {type: 'string'},
      description: {type: 'string'},
      complete: {type: 'boolean'},
      project: {type: 'integer'},
      owner: {type: 'integer'}
    },
    required: ['id', 'title', 'project', 'owner']
  },
  primaryKeys: ['id'],
  parents: [{
    name: 'users',
    from: 'owner',
    to:   'id'
  }, {
    name: 'projects',
    from: 'project',
    to:   'id'
  }],
  children: []
} as Resource;

export const users = {
  name: 'users',
  source: require('data/source'),
  schema: {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'users',
    type: 'object',
    properties: {
      id: {type: 'integer'},
      username: {type: 'string'},
      password: {type: 'string'},
      enabled: {type: 'boolean'},
      department: {type: 'integer'}
    },
    required: ['id', 'username', 'password', 'department']
  },
  primaryKeys: ['id'],
  parents: [{
    name: 'departments',
    from: 'department',
    to:   'id'
  }],
  children: [{
    name: 'tasks',
    from: 'owner',
    to:   'id'
  }]
} as Resource;

export const projects = {
  name: 'projects',
  source: require('data/source'),
  schema: {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'projects',
    type: 'object',
    properties: {
      id: {type: 'integer'},
      name: {type: 'string'}
    },
    required: ['id', 'name']
  },
  primaryKeys: ['id'],
  parents: [],
  children: [{
    name: 'tasks',
    from: 'project',
    to:   'id'
  }]
} as Resource;

export const departments = {
  name: 'departments',
  source: require('data/source'),
  schema: {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: 'departments',
    type: 'object',
    properties: {
      id: {type: 'integer'},
      name: {type: 'string'}
    },
    required: ['id', 'name']
  },
  primaryKeys: ['id'],
  parents: [],
  children: [{
    name: 'users',
    from: 'department',
    to:   'id'
  }]
} as Resource;
