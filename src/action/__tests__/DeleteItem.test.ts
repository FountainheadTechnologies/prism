import { DeleteItem } from "../DeleteItem";
import { ReadItem } from "../ReadItem";
import { Root } from "../Root";
import { Document } from "../../Document";
import { Registry } from "../../Registry";

import * as resource from "../../__mocks__/resource";
import * as hapi from "../__mocks__/hapi";

let deleteTask: DeleteItem;

beforeEach(() => {
  deleteTask = new DeleteItem(resource.tasks);
});

it("is a DELETE request to resource name and primary keys, joined by `/`", () => {
  expect(deleteTask.method).toBe("DELETE");
  expect(deleteTask.path).toBe("tasks/{id}");
});

describe("#handle()", () => {
  beforeEach(() => {
    (resource.tasks.source.delete as jest.Mock<any>).mockReturnValue(Promise.resolve(true));
  });

  it("deletes an item", async () => {
    let params = {
      id: "task1"
    };

    await deleteTask.handle(params, hapi.request);

    expect(resource.tasks.source.delete).toHaveBeenCalledWith({
      conditions: [{
        field: "id",
        value: "task1"
      }],
      source: resource.tasks.name,
      data: hapi.request.payload
    });
  });

  it("returns an empty response with a status of `204 No Content`", async () => {
    await deleteTask.handle({}, hapi.request);

    expect((hapi.request as any).generateResponse).toHaveBeenCalled();
    expect(hapi.response.code).toHaveBeenCalledWith(204);
  });
});

describe("filters", () => {
  let registry: Registry;
  let root: Root;
  let readTask: ReadItem;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    readTask = new ReadItem(resource.tasks);

    registry.registerObject(root);
    registry.registerObject(deleteTask);
  });

  it("registers a form on the Root action", async () => {
    registry.applyFilters();

    let document = new Document();
    await root.decorate(document, {}, hapi.request);

    expect(document.forms).toEqual([{
      rel: resource.tasks.name,
      href: deleteTask.path,
      name: "delete",
      method: deleteTask.method
    }]);
  });

  it("registers a form on ReadItem", async () => {
    registry.registerObject(readTask);
    registry.applyFilters();

    let document = new Document({
      id: 1337
    });

    await readTask.decorate(document, {}, hapi.request);

    expect(document.forms).toEqual([{
      rel: "self",
      href: deleteTask.path,
      name: "delete",
      params: {
        id: 1337
      },
      method: deleteTask.method
    }]);
  });
});
