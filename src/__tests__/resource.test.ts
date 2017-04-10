import * as resource from "../resource";
import * as mockResource from "../__mocks__/resource";

describe(".initialize()", () => {
  it("throws if `name` or `source` are missing", () => {
    let fn = () => resource.initialize({}, { requirePK: false });
    expect(fn).toThrowError("`resource.name` and `resource.source` must be specified");
  });

  it("throws if `primaryKeys` is missing or empty and `options.requirePK` is `true`", () => {
    let fn = () => resource.initialize({ name: "test", source: mockResource.tasks.source });
    expect(fn).toThrowError("`resource.primaryKeys` must specify at least one primary key");
  });

  it("does not throw if `primaryKeys` is missing or empty but `options.requirePK` is not `true`", () => {
    let fn = () => resource.initialize({ name: "test", source: mockResource.tasks.source }, { requirePK: false });
    expect(fn).not.toThrow();
  });

  it("clones `resource`", () => {
    let result = resource.initialize(mockResource.tasks);
    expect(result).not.toBe(mockResource.tasks);
  });

  it("does not modify an already valid `resource` object", () => {
    let result = resource.initialize(mockResource.tasks);
    expect(result).toEqual(mockResource.tasks);
  });

  it("clones and initializes missing properties on `options`", () => {
    let result = resource.initialize({
      name: "tasks",
      source: mockResource.tasks.source,
      primaryKeys: ["id"],
      schema: {
        properties: {
          name: { type: "string" }
        },
        required: ["name"]
      }
    } as any);

    expect(result).toEqual({
      name: "tasks",
      source: mockResource.tasks.source,
      primaryKeys: ["id"],
      relationships: {
        belongsTo: [],
        has: []
      },
      schema: {
        $schema: "http://json-schema.org/draft-04/schema#",
        properties: {
          name: { type: "string" }
        },
        required: ["name"],
        title: "tasks",
        type: "object"
      }
    });
  });
});
