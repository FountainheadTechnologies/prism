var {resolve} = require('path');

var {
	copyFileAsync,
	readFileAsync,
	writeFileAsync
} = require('fs-extra-promise');

const FILES = [
	'README.md',
	'CHANGELOG.md',
	'LICENSE'
];

Promise
	.all(FILES.map(file => {
		var src = resolve('../', file);
		var dest = resolve('../build', file);
		return copyFileAsync(src, dest)
			.then(() => console.log(`Copied '${src}' to '${dest}'`));
	})
	.then(() => {
		var src = resolve('../package.json',)
		return readFileAsync()
	});
