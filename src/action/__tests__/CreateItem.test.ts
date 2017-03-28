import {CreateItem} from "../CreateItem";
import {Root} from "../Root";
import {ReadItem} from "../ReadItem";
import {ReadCollection} from "../ReadCollection";
import {Registry} from "../../Registry";
import {Document} from "../../Document";
import * as schema from "../../schema";
import * as resource from "../../__mocks__/resource";
import * as hapi from "../__mocks__/hapi";

let createTask: CreateItem;

beforeEach(() => {
  createTask = new CreateItem(resource.tasks);
});

it("is a POST request to `{resourceName}`", () => {
  expect(createTask.method).toBe("POST");
  expect(createTask.path).toBe("tasks");
});

describe("#handle()", () => {
  beforeEach(() => {
    hapi.request.payload = {
      title: "New Test Task",
      owner: 1,
      project: 1
    };
  });

  it("validates request payload against resource schema", async () => {
    spyOn(schema, "validate").and.callThrough();

    await createTask.handle({}, hapi.request);

    expect(schema.validate).toHaveBeenCalledWith(hapi.request.payload, resource.tasks.schema);
    expect(resource.tasks.source.create).toHaveBeenCalledWith({
      returning: resource.tasks.primaryKeys,
      source: resource.tasks.name,
      schema: resource.tasks.schema,
      joins: [{
        from: "owner",
        path: ["owner"],
        source: "users",
        to: "id"
      }, {
        from: "project",
        path: ["project"],
        source: "projects",
        to: "id"
      }],
      data: hapi.request.payload
    });
  });

  it("returns an empty response with a status of `201 Created`", async() => {
    (resource.tasks.source.create as jest.Mock<any>).mockReturnValue(true);

    await createTask.handle({}, hapi.request);
    expect((hapi.request as any).generateResponse).toHaveBeenCalled();
    expect(hapi.response.code).toHaveBeenCalledWith(201);
  });
});

describe("#schema()", () => {
  it("returns resource schema", async () => {
    let schema = await createTask.schema({}, hapi.request);
    expect(schema).toEqual(resource.tasks.schema);
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;
  let createUser: CreateItem;
  let readTasks: ReadCollection;
  let readUser: ReadItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    createUser = new CreateItem(resource.users);
    readTasks = new ReadCollection(resource.tasks);
    readUser = new ReadItem(resource.users);

    registry.registerObject(root);
    registry.registerObject(createTask);
  });

  it("registers a form on the Root action", async () => {
    registry.applyFilters();

    let document = new Document();
    await root.decorate(document, {}, hapi.request);

    expect(document.forms).toEqual([{
      rel: resource.tasks.name,
      href: createTask.path,
      name: "create",
      method: createTask.method,
      schema: resource.tasks.schema
    }]);
  });

  it("registers a form on ReadCollection", async () => {
    registry.registerObject(readTasks);
    registry.applyFilters();

    let document = new Document({items: []});
    await readTasks.decorate(document, {}, hapi.request);

    expect(document.forms).toEqual([{
      rel: resource.tasks.name,
      href: createTask.path,
      name: "create",
      method: createTask.method,
      schema: resource.tasks.schema
    }]);
  });

  it("registers a form on parents ReadItem", async () => {
    registry.registerObject(readUser);
    registry.applyFilters();

    let document = new Document({id: 12});
    await readUser.decorate(document, {}, hapi.request);

    expect(document.forms).toEqual([{
      rel: resource.tasks.name,
      href: createTask.path,
      name: "create",
      method: createTask.method,
      schema: {
        ...resource.tasks.schema,
        default: {
          ...resource.tasks.schema.default,
          owner: 12
        }
      }
    }]);
  });

  it("recursively joins itself as a parent on child queries", async () => {
    registry.registerObject(createUser);
    registry.applyFilters();

    let joins = await createTask.joins({}, hapi.request);
    expect(joins).toEqual([{
      source: "users",
      path: ["owner"],
      from: "owner",
      to: "id"
    }, {
      source: "projects",
      path: ["project"],
      from: "project",
      to: "id"
    }, {
      source: "departments",
      path: ["owner", "department"],
      from: "department",
      to: "id"
    }]);
  });

  it("embeds its schema into Create forms on related children", async () => {
    registry.registerObject(createUser);
    registry.applyFilters();

    let document = new Document();
    await root.decorate(document, {}, hapi.request);

    expect(document.forms[0].schema).toEqual({
      ...resource.tasks.schema,
      properties: {
        ...resource.tasks.schema.properties,
        owner: {
          oneOf: [{
            type: "integer"
          }, resource.users.schema]
        }
      }
    });
  });
});
