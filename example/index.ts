import {Server} from 'hapi';
import {inspect} from 'collimator';
import prism from 'prism';
import {Prism} from 'prism';
import Read from 'prism/lib/action/item/read';

var server = new Server();
server.connection({port: 8080});

server.register(prism);
