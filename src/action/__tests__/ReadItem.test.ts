import ReadItem from 'prism/action/ReadItem';
import ReadCollection from 'prism/action/ReadCollection';
import Root from 'prism/action/Root';
import Document from '../../document';
import Registry from '../../registry';
import * as resource from 'prism/__mocks__/resource';

var readTask: ReadItem;

beforeEach(() => {
  readTask = new ReadItem(resource.tasks);
});

describe('#path', () => {
  it('is resource name and primary keys, joined by `/`', () => {
    expect(readTask.path).toBe('tasks/{id}');
  });
});

describe('#query()', () => {
  it('returns a read item query', () => {
    var params = {
      id: 'task1',
    };

    var query = readTask.query(params, undefined as any);

    expect(query).toEqual({
      return: 'item',
      source: resource.tasks.name,
      schema: resource.tasks.schema,
      conditions: [{
        field: 'id',
        value: 'task1'
      }],
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
  });
});

describe('#decorate()', () => {
  it('moves nested parent data to an embedded document and omits original key', () => {
    var document = new Document({
      id: 'task1',
      owner: 'user1',
      project: 'project1',
      users: {
        id: 'user1',
        name: 'Test User',
        department: 'department1'
      },
      projects: {
        id: 'project1',
        name: 'Test Project'
      }
    });

    readTask.decorate(document, {}, undefined as any);

    expect(document.embedded[0]).toEqual({
      rel: 'users',
      document: new Document(document.properties['users'])
    });

    expect(document.embedded[1]).toEqual({
      rel: 'projects',
      document: new Document(document.properties['projects'])
    });

    expect(document.omit).toEqual(['users', 'projects']);
  });
});

describe('filters', () => {
  var registry: Registry;
  var root: Root;
  var readUser: ReadItem;
  var readProject: ReadItem;
  var readTasks: ReadCollection;

  beforeEach(() => {
    registry = new Registry();
    root = new Root();
    readUser = new ReadItem(resource.users);
    readProject = new ReadItem(resource.projects);
    readTasks = new ReadCollection(resource.tasks);

    registry.registerAction(root);
    registry.registerAction(readTask);
  });

  it('adds a link to itself to the Root action', () => {
    var document = new Document({});
    root.decorate(document);

    expect(document.links).toEqual([{
      rel:  resource.tasks.name,
      href: readTask.path
    }]);
  });

  it('recursively joins itself as a parent on child queries', () => {
    registry.registerAction(readUser);

    var query = readTask.joins({}, undefined as any);
    expect(query).toEqual([{
      source: 'users',
      path:   ['tasks', 'users'],
      from:   'owner',
      to:     'id'
    }, {
      source: 'projects',
      path:   ['tasks', 'projects'],
      from:   'project',
      to:     'id'
    }, {
      source: 'departments',
      path:   ['tasks', 'users', 'departments'],
      from:   'department',
      to:     'id'
    }]);
  });

  it('recursively embeds itself as a parent on child queries', () => {
    registry.registerAction(readUser);

    var document = new Document({
      id: 'task1',
      owner: 'user1',
      users: {
        id: 'user1',
        name: 'Test User',
        department: 'department1',
        departments: {
          id: 'department1',
          name: 'Test Department'
        }
      },
      projects: {
        id: 'project1',
        name: 'Test Project'
      }
    });

    readTask.decorate(document, {}, undefined as any);

    expect(document.embedded[0].document.embedded[0]).toEqual({
      rel: 'departments',
      document: new Document(document.properties['users']['departments'])
    });

    expect(document.embedded[0].document.omit).toEqual(['departments']);
  });

  it('registers a link to itself on collection items', () => {
    registry.registerAction(readTasks);

    var document = new Document({
      count: 1,
      items: [{
        id: 'task1'
      }]
    });

    readTasks.decorate(document, {}, undefined as any);

    expect(document.embedded[0].document.links).toEqual([{
      rel:  'self',
      href: readTask.path,
      params: {
        id: 'task1'
      }
    }]);
  });
});
