import {tasks} from 'prism/__mocks__/resource';
import db from 'prism/source/__mocks__/pgPromise';
import PostgreSQL from 'prism/source/PostgreSQL';

import {resolve} from 'bluebird';

var source: PostgreSQL;

beforeEach(() => {
  source = new PostgreSQL(db);
  (db.oneOrNone as any).mockClear();
  (db.manyOrNone as any).mockClear();
});

describe('#create()', () => {
  it('creates an INSERT query', async () => {
    var result = await source.create({
      source: 'tasks',
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      data: {
        title: 'test insert task',
        project: 1,
        owner: 1
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'insert into "tasks" ("owner", "project", "title") values (?, ?, ?) returning "id"',
      [1, 1, 'test insert task']
    );

    expect(result).toEqual({name: 'mockOneOrNoneResult'});
  });

  xit('generates common table expression using `query.joins`', async () => {
    await source.create({
      source: 'tasks',
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      joins: [{
        source: 'users',
        path:   ['owner'],
        from:   'owner',
        to:     'id'
      }, {
        source: 'projects',
        path:   ['project'],
        from:   'project',
        to:     'id'
      }],
      data: {
        title: 'test insert task',
        project: {
          name: 'new project'
        },
        owner: {
          name: 'new user'
        }
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'insert into "tasks" ("owner", "project", "title") values (?, ?, ?) returning "id"',
      [1, 1, 'test insert task']
    );
  });
});

describe('#read()', () => {
  describe('when `query.return` is `item`', () => {
    it('creates a SELECT query using `oneOrNone`', async () => {
      var result = await source.read({
        return: 'item',
        source: 'tasks',
        schema: tasks.schema,
      });

      expect(db.oneOrNone).toHaveBeenCalledWith(
        'select "tasks".* from "tasks"',
        []
      );

      expect(result).toEqual({name: 'mockOneOrNoneResult'});
    });
  });

  it('generates field names using `query.fields`', async() => {
    await source.read({
      return: 'item',
      source: 'tasks',
      schema: tasks.schema,
      fields: ['owner', 'project']
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'select "tasks"."owner", "tasks"."project" from "tasks"',
      []
    );
  });

  it('generates WHERE terms using `query.conditions`', async () => {
    await source.read({
      return: 'item',
      source: 'tasks',
      schema: tasks.schema,
      conditions: [{
        field: 'id',
        value: 1
      }]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'select "tasks".* from "tasks" where "id" = ?',
      [1]
    );
  });

  it('generates JOIN clauses using `query.joins`', async () => {
    (db.oneOrNone as jest.Mock<any>).mockReturnValue(resolve({
      id: 1,
      title: 'test task 1 with joined data',
      user: 1,
      project: 1,
      'tasksΔusers': {
        id: 1,
        username: 'test user 1'
      },
      'tasksΔprojects': {
        id: 1,
        name: 'test project 1'
      }
    }));

    var result = await source.read({
      return: 'item',
      source: 'tasks',
      schema: tasks.schema,
      joins: [{
        source: 'users',
        path:   ['tasks', 'users'],
        from:   'owner',
        to:     'id'
      }, {
        source: 'projects',
        path:   ['tasks', 'projects'],
        from:   'project',
        to:     'id'
      }]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'select "tasks".*, row_to_json("tasksΔusers".*) as "tasksΔusers", row_to_json("tasksΔprojects".*) as "tasksΔprojects" from "tasks" inner join "users" as "tasksΔusers" on "tasksΔusers"."id" = "tasks"."owner" inner join "projects" as "tasksΔprojects" on "tasksΔprojects"."id" = "tasks"."project"',
      []
    );

    expect(result).toEqual({
      id: 1,
      title: 'test task 1 with joined data',
      user: 1,
      project: 1,
      users: {
        id: 1,
        username: 'test user 1'
      },
      projects: {
        id: 1,
        name: 'test project 1'
      }
    });
  });

  describe('when `query.return` is `collection`', () => {
    it('creates two SELECT queries', async () => {
      var result = await source.read({
        return: 'collection',
        source: 'tasks',
        schema: tasks.schema,
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        'select "tasks".* from "tasks"',
        []
      );

      expect(db.one).toHaveBeenCalledWith(
        'select count(*) from "tasks"',
        []
      );

      expect(result).toEqual({
        count: 2,
        items: [{
          name: 'mockManyOrNoneResult1'
        }, {
          name: 'mockManyOrNoneResult2'
        }]
      })
    });

    it('generates WHERE clauses for both queries', async () => {
      await source.read({
        return: 'collection',
        source: 'tasks',
        schema: tasks.schema,
        conditions: [{
          field: 'owner',
          value: 2
        }]
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        'select "tasks".* from "tasks" where "owner" = ?',
        [2]
      );

      expect(db.one).toHaveBeenCalledWith(
        'select count(*) from "tasks" where "owner" = ?',
        [2]
      );
    });

    it('generates JOIN clauses for both queries', async () => {
      (db.manyOrNone as jest.Mock<any>).mockReturnValue(resolve([{
        id: 1,
        title: 'test task 1 with joined data',
        user: 1,
        project: 1,
        'tasksΔusers': {
          id: 1,
          username: 'test user 1'
        },
        'tasksΔprojects': {
          id: 1,
          name: 'test project 1'
        }
      }, {
        id: 2,
        title: 'test task 2 with joined data',
        user: 2,
        project: 2,
        'tasksΔusers': {
          id: 2,
          username: 'test user 2'
        },
        'tasksΔprojects': {
          id: 2,
          name: 'test project 2'
        }
      }]));

      var result = await source.read({
        return: 'collection',
        source: 'tasks',
        schema: tasks.schema,
        joins: [{
          source: 'users',
          path:   ['tasks', 'users'],
          from:   'owner',
          to:     'id'
        }, {
          source: 'projects',
          path:   ['tasks', 'projects'],
          from:   'project',
          to:     'id'
        }]
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        'select "tasks".*, row_to_json("tasksΔusers".*) as "tasksΔusers", row_to_json("tasksΔprojects".*) as "tasksΔprojects" from "tasks" inner join "users" as "tasksΔusers" on "tasksΔusers"."id" = "tasks"."owner" inner join "projects" as "tasksΔprojects" on "tasksΔprojects"."id" = "tasks"."project"',
        []
      );

      expect(db.one).toHaveBeenCalledWith(
        'select count(*) from "tasks" inner join "users" as "tasksΔusers" on "tasksΔusers"."id" = "tasks"."owner" inner join "projects" as "tasksΔprojects" on "tasksΔprojects"."id" = "tasks"."project"',
        []
      )

      expect(result).toEqual({
        count: 2,
        items: [{
          id: 1,
          title: 'test task 1 with joined data',
          user: 1,
          project: 1,
          users: {
            id: 1,
            username: 'test user 1'
          },
          projects: {
            id: 1,
            name: 'test project 1'
          }
        }, {
          id: 2,
          title: 'test task 2 with joined data',
          user: 2,
          project: 2,
          users: {
            id: 2,
            username: 'test user 2'
          },
          projects: {
            id: 2,
            name: 'test project 2'
          }
        }]
      });
    });

    it('generates OFFSET and LIMIT clauses on the `items` query', async () => {
      await source.read({
        return: 'collection',
        source: 'tasks',
        schema: tasks.schema,
        page: {
          size: 20,
          number: 3
        }
      });

      expect(db.manyOrNone).toHaveBeenCalledWith(
        'select "tasks".* from "tasks" limit ? offset ?',
        [20, 60]
      );
    });
  });

});

describe('#update()', () => {
  it('generates an UPDATE query', async () => {
    await source.update({
      source: 'tasks',
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      data: {
        owner: 2,
        title: 'test update task'
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'update "tasks" set "owner" = ?, "title" = ? returning "id"',
      [2, 'test update task']
    );
  });

  it('generates WHERE terms using `query.conditions`', async () => {
    await source.update({
      source: 'tasks',
      schema: tasks.schema,
      returning: tasks.primaryKeys,
      conditions: [{
        field: 'id',
        value: 1
      }],
      data: {
        owner: 2,
        title: 'test update task'
      }
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'update "tasks" set "owner" = ?, "title" = ? where "id" = ? returning "id"',
      [2, 'test update task', 1]
    );
  });
});

describe('#delete()', () => {
  it('generates a DELETE query', async () => {
    await source.delete({
      source: 'tasks',
      schema: tasks.schema
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'delete from "tasks"',
      []
    );
  });

  it('generates WHERE terms using `query.conditions`', async () => {
    await source.delete({
      source: 'tasks',
      schema: tasks.schema,
      conditions: [{
        field: 'id',
        value: 1
      }]
    });

    expect(db.oneOrNone).toHaveBeenCalledWith(
      'delete from "tasks" where "id" = ?',
      [1]
    );
  });
});
