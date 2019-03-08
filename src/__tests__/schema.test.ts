import * as schema from "../schema";
import { tasks, projects } from "../__mocks__/resource";

import { assoc, assocPath } from "ramda";

describe(".validate()", () => {
  it("resolves to `true` when data passes schema", () => {
    expect.assertions(1);

    let data = {
      title: "Test Task",
      owner: 1,
      project: 1
    };

    return schema.validate(data, tasks.schema)
      .then(result => expect(result).toBe(true));
  });

  it("rejects with a Boom error when data does not pass schema", () => {
    expect.assertions(2);

    let data = {
      title: "Test Task"
    };

    return schema.validate(data, tasks.schema)
      .catch(error => {
        expect(error.isBoom).toBe(true);

        expect(error.output.payload).toEqual({
          statusCode: 422,
          error: "Unprocessable Entity",
          message: "Schema validation failed",
          errors: [{
            message: "should have required property 'project'",
            params: {
              missingProperty: "project"
            },
            dataPath: "",
            schemaPath: "#/required"
          }, {
            message: "should have required property 'owner'",
            params: {
              missingProperty: "owner"
            },
            dataPath: "",
            schemaPath: "#/required"
          }]
        });
      });
  });

  it("recursively formats the error messages for nested schemas", () => {
    expect.assertions(1);

    let data = {
      title: "Test Task",
      project: {
        title: "Test Project"
      }
    };

    let nestedSchema = assocPath(["properties", "project"], projects.schema, tasks.schema);

    return schema.validate(data, nestedSchema)
      .catch(error => {
        expect(error.output.payload).toEqual({
          statusCode: 422,
          error: "Unprocessable Entity",
          message: "Schema validation failed",
          errors: [{
            message: "should have required property 'name'",
            params: {
              missingProperty: "name"
            },
            dataPath: "/project",
            schemaPath: "#/properties/project/required"
          }, {
            message: "should have required property 'owner'",
            params: {
              missingProperty: "owner"
            },
            dataPath: "",
            schemaPath: "#/required"
          }]
        });
      });
  });

  it("correctly resolves asynchronous validation passes", () => {
    expect.assertions(1);

    let data = {
      title: "Test async Task",
      owner: 1,
      project: 1
    }

    let asyncSchema = assoc("$async", true, tasks.schema);

    return schema.validate(data, asyncSchema)
      .then(result => {
        expect(result).toBe(true);
      });
  });

  it("correctly rejects asynchronous validation failures", () => {
    expect.assertions(1);

    let data = {
      title: "Test async Task"
    }

    let asyncSchema = assoc("$async", true, tasks.schema);

    return schema.validate(data, asyncSchema)
      .catch(error => {
        expect(error.output.payload).toEqual({
          statusCode: 422,
          error: "Unprocessable Entity",
          message: "Schema validation failed",
          errors: [{
            message: "should have required property 'project'",
            params: {
              missingProperty: "project"
            },
            dataPath: "",
            schemaPath: "#/required"
          }, {
            message: "should have required property 'owner'",
            params: {
              missingProperty: "owner"
            },
            dataPath: "",
            schemaPath: "#/required"
          }]
        });
      });
  });
});
