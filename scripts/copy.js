var {resolve} = require('path');

var {
  copyAsync,
  readJsonAsync,
  writeJsonAsync
} = require('fs-extra-promise');

const FILES = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE'
];

const pathTo = (...args) => resolve(__dirname, '../', ...args);

Promise
  .all(FILES.map(file => {
    var src = pathTo(file);
    var dest = pathTo('build', file);

    return copyAsync(src, dest)
		  .then(() => console.log(`Copied '${src}' to '${dest}'`));
  }))
	.then(() => readJsonAsync(pathTo('package.json')))
  .then(packageJSON => {
	  Object.assign(packageJSON, {
		  name: '@optics/prism',
		  private: false
	  });

	  var dest = pathTo('build', 'package.json');

	  return writeJsonAsync(dest, packageJSON, {spaces: 2})
		  .then(() => console.log(`Configured package.json in '${dest}'`));
  });
