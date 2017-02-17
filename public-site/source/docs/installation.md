title: Installation
---
Prism is installed into an existing NodeJS application as a dependency in the traditional manner:

```bash
$ npm install --save prism
```

Prism also depends on the following libraries:

- Hapi
  Prism is implemented as a plugin to the Hapi HTTP server framework. Relying on Hapi for request/response routing and handling allows Prism to remain lightweight.
  
- pg-promise
  Prism's default data source component supports PostgreSQL databases using pg-promise.

If you're using these packages already then you're good to go. Otherwise, install them with:

```bash
$ npm install --save hapi pg-promise
```

## Minimal Prism application

All Prism applications must perform the following:

- Create and configure a new Hapi server instance
- Create and configure a pg-promise connection object
- Install Prism as a Plugin to the Hapi server
- Configure Prism's security system
- Register one or more Actions to the Prism server

Here is an annotated example of the code required to do this:

```javascript
// Create a Hapi server instance, ready to listen on port 8080
var {Server} = require('hapi');

var server = new Server();
server.connection({
  port: 8080
});

// Register the Prism plugin against the Hapi server and explicitly disable security
server.register({
  register: require('prism'),
  options: {
    secure: false
  }
});

// Create a pg-promise connection object
var pgPromise = require('pg-promise')();

// Tweak 'host' and 'database' suit your needs
var widgetDB = pgPromise({
  host: '/var/run/postgresql',
  database: 'widget-warehouse'
});

// Create a Prism data source using the pg-promise connection
var PostgreSQL = require('prism/source/PostgreSQL');
var widgetSource = new PostgreSQL(widgetDB);

// Create a ReadCollection Action bound to a PostgreSQL table named 'widgets'
var ReadCollection = require('prism/action/ReadCollection');

var readWidgets = new ReadCollection({
  source: widgetSource,
  name: 'widgets'
});

// Register the readWidgets action
server.plugins.prism.registerAction(readWidgets);

// Finally, start the server
server.start();
```
