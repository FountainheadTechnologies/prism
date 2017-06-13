import {Server} from 'hapi';
import * as _pgPromise from 'pg-promise';
import * as collimator from 'collimator';
import {Prism} from '@optics/prism';
import {PostgreSQL} from '@optics/prism/source';
import * as action from '@optics/prism/action';

const pgPromise = _pgPromise();

var server: Server;

var db = pgPromise({
  database: 'prism-integration-test',
  host: process.env.POSTGRES_HOST || '/var/run/postgresql',
  user: process.env.POSTGRES_USER,
});

beforeAll(async () => {
	server = new Server();
	server.connection({port: 8080});

  await server.register({
    register: Prism,
    options: {
      secure: false
    }
  });

  var metadata = await collimator.inspect(db);
  var source = new PostgreSQL(db);

  metadata.tables.forEach(table => {
    var resource = {...table, source};
    server.plugins['prism'].registerAction(new action.ReadItem(resource));
    server.plugins['prism'].registerAction(new action.ReadCollection(resource));
    server.plugins['prism'].registerAction(new action.CreateItem(resource));
    server.plugins['prism'].registerAction(new action.UpdateItem(resource));
    server.plugins['prism'].registerAction(new action.DeleteItem(resource));
  });

  await server.start();
});

afterAll(async () => {
  await server.stop();
  await pgPromise.end();
});

require('./common');
