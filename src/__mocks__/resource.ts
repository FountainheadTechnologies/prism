import { Resource } from "../resource";
import { source } from "./source";

export const tasks = {
  name: "tasks",
  source,
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "tasks",
    type: "object",
    properties: {
      id: { type: "integer", readOnly: true },
      title: { type: "string" },
      description: { type: "string" },
      complete: { type: "boolean" },
      project: { type: "integer" },
      owner: { type: "integer" }
    },
    required: ["title", "project", "owner"]
  },
  primaryKeys: ["id"],
  relationships: {
    belongsTo: [{
      name: "users",
      from: "owner",
      to: "id"
    }, {
      name: "projects",
      from: "project",
      to: "id"
    }],
    has: []
  }
} as Resource;

export const users = {
  name: "users",
  source,
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "users",
    type: "object",
    properties: {
      id: { type: "integer", readOnly: true },
      email: { type: "string" },
      username: { type: "string" },
      password: { type: "string" },
      enabled: { type: "boolean" },
      department: { type: "integer" }
    },
    required: ["username", "password", "department"]
  },
  primaryKeys: ["id"],
  relationships: {
    belongsTo: [{
      name: "departments",
      from: "department",
      to: "id"
    }],
    has: [{
      name: "tasks",
      from: "id",
      to: "owner"
    }]
  }
} as Resource;

export const projects = {
  name: "projects",
  source,
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "projects",
    type: "object",
    properties: {
      id: { type: "integer", readOnly: true },
      name: { type: "string" }
    },
    required: ["name"]
  },
  primaryKeys: ["id"],
  relationships: {
    belongsTo: [],
    has: [{
      name: "tasks",
      from: "id",
      to: "project"
    }]
  }
} as Resource;

export const departments = {
  name: "departments",
  source,
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "departments",
    type: "object",
    properties: {
      id: { type: "integer", readOnly: true },
      name: { type: "string" }
    },
    required: ["name"]
  },
  primaryKeys: ["id"],
  relationships: {
    belongsTo: [],
    has: [{
      name: "users",
      from: "id",
      to: "department"
    }]
  }
} as Resource;
