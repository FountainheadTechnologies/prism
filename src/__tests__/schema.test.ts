import * as schema from "../schema";
import { tasks, projects } from "../__mocks__/resource";

import { assocPath } from "ramda";

describe(".validate()", () => {
  it("resolves to `true` when data passes schema", () => {
    let data = {
      title: "Test Task",
      owner: 1,
      project: 1
    };

    return schema.validate(data, tasks.schema)
      .then(result => expect(result).toBe(true));
  });

  it("rejects with a Boom error when data does not pass schema", () => {
    let data = {
      title: "Test Task"
    };

    return schema.validate(data, tasks.schema)
      .catch(error => {
        expect(error.isBoom).toBe(true);

        expect(error.output.payload).toEqual({
          statusCode: 422,
          error: "Unprocessable Entity",
          errors: [{
            message: "Missing required property: project",
            params: {
              key: "project"
            },
            dataPath: "",
            schemaPath: "/required/1"
          }, {
            message: "Missing required property: owner",
            params: {
              key: "owner"
            },
            dataPath: "",
            schemaPath: "/required/2"
          }]
        });
      });
  });

  it("recursively formats the error messages for nested schemas", () => {
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
          errors: [{
            message: "Missing required property: owner",
            params: {
              key: "owner"
            },
            dataPath: "",
            schemaPath: "/required/2"
          }, {
            message: "Missing required property: name",
            params: {
              key: "name"
            },
            dataPath: "/project",
            schemaPath: "/properties/project/required/0"
          }]
        });
      });
  });
});
