import {ReadItem} from "../ReadItem";
import {ReadCollection} from "../ReadCollection";
import {CreateItem} from "../CreateItem";
import {Root} from "../Root";
import {Document} from "../../Document";
import {Registry} from "../../Registry";
import * as resource from "../../__mocks__/resource";
import * as hapi from "../__mocks__/hapi";

let readTask: ReadItem;

beforeEach(() => {
  readTask = new ReadItem(resource.tasks);
});

describe("#path", () => {
  it("is resource name and primary keys, joined by `/`", () => {
    expect(readTask.path).toBe("tasks/{id}");
  });
});

describe("#query()", () => {
  it("returns a read item query", () => {
    let params = {
      id: "task1",
    };

    let query = readTask.query(params, undefined as any);

    expect(query).toEqual({
      return: "item",
      source: resource.tasks.name,
      schema: resource.tasks.schema,
      conditions: [{
        field: "id",
        value: "task1"
      }],
      joins: [{
        source: "users",
        path:   ["tasks", "users"],
        from:   "owner",
        to:     "id"
      }, {
        source: "projects",
        path:   ["tasks", "projects"],
        from:   "project",
        to:     "id"
      }]
    });
  });
});

describe("#decorate()", () => {
  it("moves nested parent data to an embedded document and omits original key", () => {
    let document = new Document({
      id: "task1",
      owner: "user1",
      project: "project1",
      users: {
        id: "user1",
        name: "Test User",
        department: "department1"
      },
      projects: {
        id: "project1",
        name: "Test Project"
      }
    });

    readTask.decorate(document, {}, undefined as any);

    expect(document.properties["users"]).toBeUndefined();
    expect(document.embedded[0]).toEqual({
      rel: "users",
      document: new Document({
        id: "user1",
        name: "Test User",
        department: "department1"
      })
    });

    expect(document.properties["projects"]).toBeUndefined();
    expect(document.embedded[1]).toEqual({
      rel: "projects",
      document: new Document({
        id: "project1",
        name: "Test Project"
      })
    });
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;
  let readUser: ReadItem;
  let readProject: ReadItem;
  let readTasks: ReadCollection;
  let createTask: CreateItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    readUser = new ReadItem(resource.users);
    readProject = new ReadItem(resource.projects);
    readTasks = new ReadCollection(resource.tasks);
    createTask = new CreateItem(resource.tasks);

    registry.registerAction(root);
    registry.registerAction(readTask);
  });

  it("adds a link to itself to the Root action", () => {
    registry.applyFilters();

    let document = new Document({});
    root.decorate(document, {}, {} as any);

    expect(document.links).toEqual([{
      rel:  resource.tasks.name,
      href: readTask.path,
      name: "item"
    }]);
  });

  it("sets the `Location` response header on CreateItem", async () => {
    registry.registerAction(createTask);
    registry.applyFilters();

    hapi.request.payload = {
      title: "New Test Task",
      owner: 1,
      project: 1
    };

    (resource.tasks.source.create as jest.Mock<any>).mockReturnValue({id: 12});

    await createTask.handle({}, hapi.request);
    expect(hapi.response.location).toHaveBeenCalledWith("tasks/12");
  });

  it("recursively joins itself as a parent on child queries", () => {
    registry.registerAction(readUser);
    registry.applyFilters();

    let query = readTask.joins({}, undefined as any);
    expect(query).toEqual([{
      source: "users",
      path:   ["tasks", "users"],
      from:   "owner",
      to:     "id"
    }, {
      source: "projects",
      path:   ["tasks", "projects"],
      from:   "project",
      to:     "id"
    }, {
      source: "departments",
      path:   ["tasks", "users", "departments"],
      from:   "department",
      to:     "id"
    }]);
  });

  it("recursively embeds itself as a parent on child queries", () => {
    registry.registerAction(readUser);
    registry.applyFilters();

    let document = new Document({
      id: "task1",
      owner: "user1",
      users: {
        id: "user1",
        name: "Test User",
        department: "department1",
        departments: {
          id: "department1",
          name: "Test Department"
        }
      },
      projects: {
        id: "project1",
        name: "Test Project"
      }
    });

    readTask.decorate(document, {}, undefined as any);

    expect(document.embedded[0].document.properties["departments"]).toBeUndefined();
    expect(document.embedded[0].document.embedded[0]).toEqual({
      rel: "departments",
      document: new Document({
        id: "department1",
        name: "Test Department"
      })
    });
  });

  it("recursively decorates itself on child collection queries", () => {
    registry.registerAction(readTasks);
    registry.registerAction(readUser);
    registry.registerAction(readProject);
    registry.applyFilters();

    let document = new Document({
      count: 1,
      items: [{
        id: "task1",
        owner: "user1",
        project: "project1",
        users: {
          id: "user1",
          name: "Test User",
          department: "department1",
          departments: {
            id: "department1",
            name: "Test Department"
          }
        },
        projects: {
          id: "project1",
          name: "Test Project"
        }
      }]
    });

    readTasks.decorate(document, {}, undefined as any);

    let task = document.embedded[0].document;

    let taskSelfLink = task.links[0];
    expect(taskSelfLink.rel).toBe("self");
    expect(taskSelfLink.href).toBe(readTask.path);
    expect((taskSelfLink as any).params.id).toBe("task1");

    expect(task.embedded.length).toBe(2);

    let owner = task.embedded[0].document;
    let ownerSelfLink = owner.links[0];
    expect(ownerSelfLink.rel).toBe("self");
    expect(ownerSelfLink.href).toBe(readUser.path);
    expect((ownerSelfLink as any).params.id).toBe("user1");

    let project = task.embedded[1].document;
    let projectSelfLink = project.links[0];
    expect(projectSelfLink.rel).toBe("self");
    expect(projectSelfLink.href).toBe(readProject.path);
    expect((projectSelfLink as any).params.id).toBe("project1");
  });
});
