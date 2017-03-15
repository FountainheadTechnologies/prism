import {Resource} from "../Resource";
import {users} from "../../../__mocks__/resource";
import {request} from "../../../action/__mocks__/hapi";
import {Registry} from "../../../Registry";
import {Root} from "../../../action/Root";
import {ReadItem} from "../../../action/ReadItem";
import {CreateItem} from "../../../action/CreateItem";
import {UpdateItem} from "../../../action/UpdateItem";
import {Document} from "../../../Document";

import {merge} from "ramda";

let resource: Resource;

beforeEach(() => {
  resource = new Resource(users, {
    identity: "email"
  });
});

describe("#schema", () => {
  it("defines and requires `identity` and `password` properties", () => {
    expect(resource.schema.properties).toEqual({
      email: {type: "string"},
      password: {type: "string"}
    });

    expect(resource.schema.required).toEqual(["email", "password"]);
  });
});

describe("#issue()", () => {
  beforeEach(() => {
    (users.source.read as jest.Mock<any>).mockReturnValue(Promise.resolve({
      id: 12,
      email: "user@test.com",
      password: "hashed:password"
    }));
  });

  it("throws a validation error if payload does not pass schema validation", async () => {
    try {
      await resource.issue({username: "test", password: "password"});
    } catch (error) {
      expect(error.message).toEqual("Unprocessable Entity");
    }
  });

  it("performs a `read` query against the resource using payload", async () => {
    await resource.issue({email: "user@test.com", password: "password"});

    expect(users.source.read).toHaveBeenCalledWith({
      source: users.name,
      schema: resource.schema,
      return: "item",
      conditions: [{
        field: "email",
        value: "user@test.com"
      }]
    });
  });

  describe("when `read` query returns a result", () => {
    describe("when `password` matches hashed password", () => {
      it("resolves to an object containing primary key(s)", async () => {
        let result = await resource.issue({email: "user@test.com", password: "password"});
        expect(result).toEqual({
          users: {
            id: 12
          }
        });
      });
    });

    describe("when `password` does not match hashed password", () => {
      it("resolves to `false`", async () => {
        let result = await resource.issue({email: "user@test.com", password: "oops"});
        expect(result).toBe(false);
      });
    });
  });

  describe("when `read` query does not return a result", () => {
    it("resolves to `false`", async () => {
      (users.source.read as jest.Mock<any>).mockReturnValue(Promise.resolve(null));
      let result = await resource.issue({email: "user1@test.com", password: "password"});
      expect(result).toBe(false);
    });
  });
});

describe("#validate()", () => {
  let token = {
    users: {
      id: 12
    }
  };

  it("performs a `read` query against the resource using decoded token object", async () => {
    await resource.validate(token, request);

    expect(users.source.read).toHaveBeenCalledWith({
      source: users.name,
      schema: resource.schema,
      return: "item",
      conditions: [{
        field: "id",
        value: 12
      }]
    });
  });

  it("coerces any error to `false`", async () => {
    (users.source.read as jest.Mock<any>).mockReturnValue(Promise.reject("oops"));

    let result = await resource.validate(token, request);
    expect(result).toBe(false);
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;
  let readItem: ReadItem;
  let createItem: CreateItem;
  let updateItem: UpdateItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    readItem = new ReadItem(users);
    createItem = new CreateItem(users);
    updateItem = new UpdateItem(users);

    registry.registerAction(root);
    registry.registerAction(readItem);
    registry.registerAction(createItem);
    registry.registerAction(updateItem);
    registry.registerFilter(resource.filters);
    registry.applyFilters();
  });

  it("redacts `password` in ReadItem#decorate", async () => {
    let document = new Document({
      email: "user@test.com",
      password: "hashed:password"
    });

    await readItem.decorate(document, {}, request);

    expect(document.properties).toEqual({
      email: "user@test.com",
      password: "**REDACTED**"
    });
  });

  it("hashes passwords during create", async () => {
    (users.source.create as jest.Mock<any>).mockReturnValue(Promise.resolve({
      id: 13
    }));

    await createItem.handle({}, merge(request, {
      payload: {
        username: "user1",
        email: "newuser@test.com",
        password: "password",
        department: 1
      }
    }));

    expect((users.source.create as jest.Mock<any>).mock.calls[0][0].data).toEqual({
      username: "user1",
      email: "newuser@test.com",
      password: "hashed:password",
      department: 1
    });
  });

  it("hashes passwords during update", async () => {
    (users.source.update as jest.Mock<any>).mockReturnValue({
      id: 12
    });

    await updateItem.handle({}, merge(request, {
      payload: {
        password: "newpassword",
      }
    }));

    expect((users.source.update as jest.Mock<any>).mock.calls[0][0].data).toEqual({
      password: "hashed:newpassword"
    });
  });

  it("adds a link to current user to Root resource", async () => {
    let doc = new Document();

    await root.decorate(doc, {}, merge(request, {
      auth: {
        credentials: {
          id: 12,
          password: "hashed:password"
        }
      }
    }));

    expect(doc.links.find(link => link.name === "identity")).toEqual({
      rel: "users",
      name: "identity",
      href: "users/{id}",
      params: {
        id: 12
      }
    });
  });
});
