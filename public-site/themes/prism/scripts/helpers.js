hexo.extend.helper.register('currentSection', function() {
  return this.page.canonical_path.split('/')[0];
});

hexo.extend.helper.register('active', function(path, className) {
  className = className || 'active';

  var parts = this.page.canonical_path.split('/');

  if (path === parts[0]) {
    return className;
  }

  return '';
});

hexo.extend.helper.register('sidebar', function() {
  var parts = this.page.canonical_path.split('/');
  var section = parts[0];

  return this.site.data.sidebar[section] || [];
});
