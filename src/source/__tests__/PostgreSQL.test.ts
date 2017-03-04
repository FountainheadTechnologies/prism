import {tasks} from "../../__mocks__/resource";
import {db} from "../__mocks__/pgPromise";
import {PostgreSQL} from "../PostgreSQL";

let source: PostgreSQL;

beforeEach(() => {
  source = new PostgreSQL(db);
  (db.oneOrNone as any).mockClear();
  (db.manyOrNone as any).mockClear();
});

describe("#create()", () => {
  it("creates an INSERT query", async () => {
    let result = await source.create({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      data: {
        title: "test insert task",
        project: 1,
        owner: 1
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "INSERT INTO tasks (title, project, owner) VALUES ($1, $2, $3) RETURNING id",
      ["test insert task", 1, 1]
    );

    expect(result).toEqual({name: "mockOneOrNoneResult"});
  });

  it("generates common table expression using `query.joins`", async () => {
    await source.create({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      joins: [{
        source: "users",
        path:   ["owner"],
        from:   "owner",
        to:     "id"
      }, {
        source: "projects",
        path:   ["project"],
        from:   "project",
        to:     "id"
      }],
      data: {
        title: "test insert task",
        project: {
          name: "new project"
        },
        owner: {
          name: "new user"
        }
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "WITH project AS (INSERT INTO projects (name) VALUES ($1) RETURNING id), owner AS (INSERT INTO users (name) VALUES ($2) RETURNING id) INSERT INTO tasks (title, project, owner) VALUES ($3, (SELECT id FROM project), (SELECT id FROM owner)) RETURNING id",
      ["new project", "new user", "test insert task"]
    );
  });

  it("transforms constraint violations to Boom errors", done => {
    (db.oneOrNone as jest.Mock<any>).mockReturnValueOnce(Promise.reject({
      routine: "ri_ReportViolation",
      detail: "Key (owner)=(100) is not present in table \"users\"."
    }));

    source.create({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      data: {
        title: "test insert task",
        project: 1,
        owner: 100
      }
    }).catch(error => {
      expect(error.isBoom).toBe(true);
      expect(error.output.payload.errors).toEqual([{
        message:  "Constraint violation",
        dataPath: "/owner",
        schemaPath: "/properties/owner/constraint"
      }]);

      done();
    });
  });
});

describe("#read()", () => {
  describe("when `query.return` is `item`", () => {
    it("creates a SELECT query using `oneOrNone`", async () => {
      let result = await source.read({
        return: "item",
        source: "tasks",
        schema: tasks.schema,
      });

      expect(db.oneOrNone).toHaveBeenCalledWith(
        "SELECT tasks.* FROM tasks",
        []
      );

      expect(result).toEqual({name: "mockOneOrNoneResult"});
    });
  });

  it("generates field names using `query.fields`", async() => {
    await source.read({
      return: "item",
      source: "tasks",
      schema: tasks.schema,
      fields: ["owner", "project"]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "SELECT tasks.owner, tasks.project FROM tasks",
      []
    );
  });

  it("supports raw field names in `query.fields`", async () => {
    await source.read({
      return: "item",
      source: "tasks",
      schema: tasks.schema,
      fields: ["owner", {
        $raw: {
          fragment: "COUNT(tasks.project) OVER ()"
        }
      }]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "SELECT tasks.owner, COUNT(tasks.project) OVER () FROM tasks",
      []
    );
  });

  it("generates WHERE terms using `query.conditions`", async () => {
    await source.read({
      return: "item",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        field: "id",
        value: 1
      }]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.id = $1)",
      [1]
    );
  });

  it("supports custom operators in WHERE terms", async() => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        field: "title",
        value: "%foo%",
        operator: "LIKE"
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.title LIKE $1)",
      ["%foo%"]
    );
  });

  it("generates AND clauses in WHERE terms when using multiple conditions", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        field: "title",
        value: "%foo%",
        operator: "LIKE"
      }, {
        field: "project",
        value: 1
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.title LIKE $1) AND (tasks.project = $2)",
      ["%foo%", 1]
    );
  });

  it("generates AND clauses in WHERE terms when using $and", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        $and: [{
          field: "title",
          value: "%foo%",
          operator: "LIKE"
        }, {
          field: "project",
          value: 1
        }]
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.title LIKE $1 AND tasks.project = $2)",
      ["%foo%", 1]
    );
  });

  it("generates OR clauses in WHERE terms when using $or", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        $or: [{
          field: "title",
          value: "%foo%",
          operator: "LIKE"
        }, {
          field: "project",
          value: 1
        }]
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.title LIKE $1 OR tasks.project = $2)",
      ["%foo%", 1]
    );
  });

  it("generates AND and OR clauses in WHERE terms when using a combination of terms", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        $or: [{
          field: "project",
          value: 1
        }, {
          field: "project",
          value: 2
        }],
      }, {
        field: "title",
        value: "%foo%",
        operator: "LIKE"
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (tasks.project = $1 OR tasks.project = $2) AND (tasks.title LIKE $3)",
      [1, 2, "%foo%"]
    );
  });

  it("generates raw WHERE terms when using $raw`", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        $raw: {
          fragment: "CONCAT(tasks.title, tasks.description) LIKE ?",
          values: ["%test%"]
        }
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (CONCAT(tasks.title, tasks.description) LIKE ($1))",
      ["%test%"]
    );
  });

  it("combines $raw, $and and $or", async () => {
    await source.read({
      return: "collection",
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        $or: [{
          $raw: {
            fragment: "CONCAT(tasks.title, tasks.description) LIKE ?",
            values: ["%test%"]
          }
        }, {
          field: "project",
          value: 1
        }]
      }, {
        field: "owner",
        value: 2
      }]
    });

    expect(db.manyOrNone).toHaveBeenCalledWith(
      "SELECT tasks.* FROM tasks WHERE (CONCAT(tasks.title, tasks.description) LIKE ($1) OR tasks.project = $2) AND (tasks.owner = $3)",
      ["%test%", 1, 2]
    );
  });

  it("generates JOIN clauses using `query.joins`", async () => {
    (db.oneOrNone as jest.Mock<any>).mockReturnValue(Promise.resolve({
      id: 1,
      title: "test task 1 with joined data",
      user: 1,
      project: 1,
      "tasksΔusers": {
        id: 1,
        username: "test user 1"
      },
      "tasksΔprojects": {
        id: 1,
        name: "test project 1"
      }
    }));

    let result = await source.read({
      return: "item",
      source: "tasks",
      schema: tasks.schema,
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

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "SELECT tasks.*, row_to_json(tasksΔusers.*) AS tasksΔusers, row_to_json(tasksΔprojects.*) AS tasksΔprojects FROM tasks LEFT JOIN users AS tasksΔusers ON (tasksΔusers.id = tasks.owner) LEFT JOIN projects AS tasksΔprojects ON (tasksΔprojects.id = tasks.project)",
      []
    );

    expect(result).toEqual({
      id: 1,
      title: "test task 1 with joined data",
      user: 1,
      project: 1,
      users: {
        id: 1,
        username: "test user 1"
      },
      projects: {
        id: 1,
        name: "test project 1"
      }
    });
  });

  it("omits mising JOIN properties", async () => {
    (db.oneOrNone as jest.Mock<any>).mockReturnValue(Promise.resolve({
      id: 1,
      title: "test task 1 with joined data",
      user: 1,
      project: 1,
      "tasksΔusers": null,
      "tasksΔprojects": {
        id: 1,
        name: "test project 1"
      }
    }));

    let result = await source.read({
      return: "item",
      source: "tasks",
      schema: tasks.schema,
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

    expect(result).toEqual({
      id: 1,
      title: "test task 1 with joined data",
      user: 1,
      project: 1,
      projects: {
        id: 1,
        name: "test project 1"
      }
    });
  });

  describe("when no result is returned", () => {
    it("rejects with a Boom error", done => {
      (db.oneOrNone as jest.Mock<any>).mockReturnValueOnce(Promise.resolve(null));
      return source.read({
        return: "item",
        source: "tasks",
        schema: tasks.schema,
      }).catch(err => {
        expect(err.isBoom).toBe(true);
        expect(err.output.payload).toEqual({
          statusCode: 404,
          error: "Not Found"
        });

        done();
      });
    });
  });

  describe("when `query.return` is `collection`", () => {
    it("creates two SELECT queries", async () => {
      let result = await source.read({
        return: "collection",
        source: "tasks",
        schema: tasks.schema,
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        "SELECT tasks.* FROM tasks",
        []
      );

      expect(db.one).toHaveBeenCalledWith(
        "SELECT COUNT(*) FROM tasks",
        []
      );

      expect(result).toEqual({
        count: 2,
        items: [{
          name: "mockManyOrNoneResult1"
        }, {
          name: "mockManyOrNoneResult2"
        }]
      });
    });

    it("generates WHERE clauses for both queries", async () => {
      await source.read({
        return: "collection",
        source: "tasks",
        schema: tasks.schema,
        conditions: [{
          field: "owner",
          value: 2
        }]
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        "SELECT tasks.* FROM tasks WHERE (tasks.owner = $1)",
        [2]
      );

      expect(db.one).toHaveBeenCalledWith(
        "SELECT COUNT(*) FROM tasks WHERE (tasks.owner = $1)",
        [2]
      );
    });

    it("generates JOIN clauses for both queries", async () => {
      (db.manyOrNone as jest.Mock<any>).mockReturnValue(Promise.resolve([{
        id: 1,
        title: "test task 1 with joined data",
        user: 1,
        project: 1,
        "tasksΔusers": {
          id: 1,
          username: "test user 1"
        },
        "tasksΔprojects": {
          id: 1,
          name: "test project 1"
        }
      }, {
        id: 2,
        title: "test task 2 with joined data",
        user: 2,
        project: 2,
        "tasksΔusers": {
          id: 2,
          username: "test user 2"
        },
        "tasksΔprojects": {
          id: 2,
          name: "test project 2"
        }
      }]));

      let result = await source.read({
        return: "collection",
        source: "tasks",
        schema: tasks.schema,
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

      expect(db.manyOrNone).toHaveBeenCalledWith(
        "SELECT tasks.*, row_to_json(tasksΔusers.*) AS tasksΔusers, row_to_json(tasksΔprojects.*) AS tasksΔprojects FROM tasks LEFT JOIN users AS tasksΔusers ON (tasksΔusers.id = tasks.owner) LEFT JOIN projects AS tasksΔprojects ON (tasksΔprojects.id = tasks.project)",
        []
      );

      expect(db.one).toHaveBeenCalledWith(
        "SELECT COUNT(*) FROM tasks LEFT JOIN users AS tasksΔusers ON (tasksΔusers.id = tasks.owner) LEFT JOIN projects AS tasksΔprojects ON (tasksΔprojects.id = tasks.project)",
        []
      );

      expect(result).toEqual({
        count: 2,
        items: [{
          id: 1,
          title: "test task 1 with joined data",
          user: 1,
          project: 1,
          users: {
            id: 1,
            username: "test user 1"
          },
          projects: {
            id: 1,
            name: "test project 1"
          }
        }, {
          id: 2,
          title: "test task 2 with joined data",
          user: 2,
          project: 2,
          users: {
            id: 2,
            username: "test user 2"
          },
          projects: {
            id: 2,
            name: "test project 2"
          }
        }]
      });
    });

    it("generates OFFSET and LIMIT clauses on the `items` query", async () => {
      await source.read({
        return: "collection",
        source: "tasks",
        schema: tasks.schema,
        page: {
          size: 20,
          number: 3
        }
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        "SELECT tasks.* FROM tasks LIMIT $1 OFFSET $2",
        [20, 40]
      );
    });

    it("generates ORDER BY clause on the `items` query", async () => {
      await source.read({
        return: "collection",
        source: "tasks",
        schema: tasks.schema,
        order: [{
          field: "project",
          direction: "desc"
        }, {
          field: "title",
          direction: "ASC"
        }]
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        "SELECT tasks.* FROM tasks ORDER BY tasks.project DESC, tasks.title ASC",
        []
      );
    });
  });
});

describe("#update()", () => {
  it("generates an UPDATE query", async () => {
    await source.update({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      data: {
        owner: 2,
        title: "test update task"
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "UPDATE tasks SET owner = $1, title = $2 RETURNING id",
      [2, "test update task"]
    );
  });

  it("generates WHERE terms using `query.conditions`", async () => {
    await source.update({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      conditions: [{
        field: "id",
        value: 1
      }],
      data: {
        owner: 2,
        title: "test update task"
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      "UPDATE tasks SET owner = $1, title = $2 WHERE (tasks.id = $3) RETURNING id",
      [2, "test update task", 1]
    );
  });

  it("transforms constraint violations to Boom errors", done => {
    (db.oneOrNone as jest.Mock<any>).mockReturnValueOnce(Promise.reject({
      routine: "ri_ReportViolation",
      detail: "Key (owner)=(100) is not present in table \"users\"."
    }));

    source.update({
      source: "tasks",
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      conditions: [{
        field: "id",
        value: 1
      }],
      data: {
        owner: 100,
        title: "test update task"
      }
    }).catch(error => {
      expect(error.isBoom).toBe(true);
      expect(error.output.payload.errors).toEqual([{
        message:  "Constraint violation",
        dataPath: "/owner",
        schemaPath: "/properties/owner/constraint"
      }]);

      done();
    });
  });
});

describe("#delete()", () => {
  it("generates a DELETE query", async () => {
    await source.delete({
      source: "tasks",
      schema: tasks.schema
    });

    expect(db.result).toHaveBeenCalledWith(
      "DELETE FROM tasks",
      []
    );
  });

  it("generates WHERE terms using `query.conditions`", async () => {
    await source.delete({
      source: "tasks",
      schema: tasks.schema,
      conditions: [{
        field: "id",
        value: 1
      }]
    });

    expect(db.result).toHaveBeenCalledWith(
      "DELETE FROM tasks WHERE (tasks.id = $1)",
      [1]
    );
  });

  it("throws a notFound error if no rows were deleted", async () => {
    (db.result as jest.Mock<any>).mockReturnValueOnce(Promise.resolve({
      rowCount: 0
    }));

    try {
      await source.delete({
        source: "tasks",
        schema: tasks.schema,
        conditions: [{
          field: "id",
          value: 1
        }]
      });
    } catch (e) {
      expect(e.isBoom).toBe(true);
      expect(e.message).toBe("Not Found");
    }
  });
});
