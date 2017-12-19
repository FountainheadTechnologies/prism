import { ReadCollection } from "../ReadCollection";
import { ReadItem } from "../ReadItem";
import { Root } from "../Root";
import { Document } from "../../Document";
import { Registry } from "../../Registry";
import * as resource from "../../__mocks__/resource";

let readTasks: ReadCollection;

beforeEach(() => {
  readTasks = new ReadCollection(resource.tasks);
});

describe("#path", () => {
  it("is resource name with `where`, `page` and `order` params", () => {
    expect(readTasks.path).toBe("tasks{?where,page,order}");
  });
});

describe("#query()", () => {
  it("returns a read collection query", async () => {
    let query = await readTasks.query({}, {} as any);
    expect(query).toEqual({
      return: "collection",
      source: resource.tasks.name,
      schema: resource.tasks.schema,
      conditions: [],
      joins: [{
        source: "users",
        path: ["tasks", "users"],
        from: "owner",
        to: "id"
      }, {
        source: "projects",
        path: ["tasks", "projects"],
        from: "project",
        to: "id"
      }],
      order: [{
        field: "id",
        direction: "asc"
      }],
      page: {
        number: 1,
        size: 20
      }
    });
  });

  it("converts `params.where` into conditions", async () => {
    let params = {
      where: {
        owner: "user1"
      }
    };

    let query = await readTasks.query(params, {} as any);
    expect(query.conditions).toEqual([{
      field: "owner",
      value: "user1"
    }]);
  });

  it("converts `params.order` into order clauses", async () => {
    let params = {
      order: {
        "id": "desc"
      }
    };

    let query = await readTasks.query(params, {} as any);
    expect(query.order).toEqual([{
      field: "id",
      direction: "desc"
    }]);
  });

  it("uses `params.page` to determine page number", async () => {
    let params = {
      page: "6"
    };

    let query = await readTasks.query(params, {} as any);
    expect(query.page).toEqual({
      number: 6,
      size: 20
    });
  });
});

describe("#decorate()", () => {
  it("adds pagination links", async () => {
    let tests = [{
      page: "1",
      expectedLinks: [{
        rel: "next",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 2
        }
      }, {
        rel: "last",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 3
        }
      }]
    }, {
      page: "2",
      expectedLinks: [{
        rel: "first",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 1
        }
      }, {
        rel: "prev",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 1
        }
      }, {
        rel: "next",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 3
        }
      }, {
        rel: "last",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 3
        }
      }]
    }, {
      page: "3",
      expectedLinks: [{
        rel: "first",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 1
        }
      }, {
        rel: "prev",
        href: "tasks{?where,page,order}",
        public: true,
        params: {
          page: 2
        }
      }]
    }];

    await Promise.all(tests.map(async ({ page, expectedLinks }) => {
      let params = { page };
      let document = new Document({
        items: [],
        count: 55
      });

      await readTasks.decorate(document, params, {} as any);

      expect(document.links).toEqual(expectedLinks);
    });
  });

  it("embeds each document in `items` and omits `items`", async () => {
    let properties = {
      items: [{
        id: "task1",
        owner: "user1",
        project: "project1",
        users: null,
        projects: {
          id: "project1",
          name: "Test Project 1"
        }
      }, {
        id: "task2",
        owner: "user2",
        project: "project2",
        users: {
          id: "user2",
          name: "Test User 2",
          department: "department2"
        },
        projects: {
          id: "project2",
          name: "Test Project 2"
        }
      }],
      count: 2
    };

    let document = new Document({ ...properties });

    await readTasks.decorate(document, {}, {} as any);
    expect(document.properties["items"]).toBeUndefined();

    let task1 = new Document({
      id: "task1",
      owner: "user1",
      project: "project1"
    });

    let task1project = new Document({
      id: "project1",
      name: "Test Project 1"
    });

    Object.assign(task1, {
      embedded: [{
        rel: "projects",
        document: task1project
      }]
    });

    expect(document.embedded[0]).toEqual({
      rel: "tasks",
      alwaysArray: true,
      document: task1,
    });

    let task2 = new Document({
      id: "task2",
      owner: "user2",
      project: "project2"
    });

    let task2user = new Document({
      id: "user2",
      name: "Test User 2",
      department: "department2"
    });

    let task2project = new Document({
      id: "project2",
      name: "Test Project 2"
    });

    Object.assign(task2, {
      embedded: [{
        rel: "users",
        document: task2user
      }, {
        rel: "projects",
        document: task2project
      }]
    });

    expect(document.embedded[1]).toEqual({
      rel: "tasks",
      document: task2,
      alwaysArray: true
    });
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;
  let readUsers: ReadCollection;
  let readUser: ReadItem;
  let readProject: ReadItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    readUsers = new ReadCollection(resource.users);
    readUser = new ReadItem(resource.users);
    readProject = new ReadItem(resource.projects);

    registry.registerObject(root);
    registry.registerObject(readTasks);
  });

  it("adds a link to itself to the Root action", async () => {
    registry.applyFilters();

    let document = new Document({});
    await root.decorate(document, {}, {} as any);

    expect(document.links).toEqual([{
      rel: resource.tasks.name,
      href: readTasks.path,
      name: "collection"
    }]);
  });

  it("adds links to itself to parent ReadItem actions", async () => {
    registry.registerObject(readUser);
    registry.registerObject(readProject);
    registry.applyFilters();

    let user = new Document({
      id: "user1"
    });

    await readUser.decorate(user, {}, {} as any);

    expect(user.links).toEqual([{
      rel: "tasks",
      href: readTasks.path,
      name: "collection",
      params: {
        where: {
          owner: "user1"
        }
      }
    }]);

    let project = new Document({
      id: "project1"
    });

    await readProject.decorate(project, {}, {} as any);

    expect(project.links).toEqual([{
      rel: "tasks",
      href: readTasks.path,
      name: "collection",
      params: {
        where: {
          project: "project1"
        }
      }
    }]);
  });

  it("recursively joins itself as a parent on child queries", async () => {
    registry.registerObject(readUsers);
    registry.applyFilters();

    let query = await readTasks.joins({}, {} as any);
    expect(query).toEqual([{
      source: "users",
      path: ["tasks", "users"],
      from: "owner",
      to: "id"
    }, {
      source: "projects",
      path: ["tasks", "projects"],
      from: "project",
      to: "id"
    }, {
      source: "departments",
      path: ["tasks", "users", "departments"],
      from: "department",
      to: "id"
    }]);
  });
});
