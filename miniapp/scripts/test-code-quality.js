const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function filesUnder(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(file, extension);
    return file.endsWith(extension) ? [file] : [];
  });
}

function componentTags(file) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return [...new Set([...source.matchAll(/<(rh-[\w-]+)\b/g)].map(match => match[1]))];
}

test('local dev settings do not override the cold-rebuild policy with hot reload', () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  const privatePath = path.join(root, 'project.private.config.json');
  const local = fs.existsSync(privatePath) ? JSON.parse(fs.readFileSync(privatePath, 'utf8')) : {};
  const settings = { ...project.setting, ...local.setting };
  assert.equal(settings.compileHotReLoad, false,
    'After changing lazy-loading/component declarations, use a full compile instead of hot reload');
});

test('app enables required-component injection without eager global components', () => {
  assert.equal(app.lazyCodeLoading, 'requiredComponents');
  assert.deepEqual(app.usingComponents || {}, {});
});

test('every page and component explicitly declares its own used rh components', () => {
  const templates = ['pages', 'components'].flatMap(folder =>
    filesUnder(path.join(root, folder), '.wxml'));
  for (const template of templates) {
    const base = template.slice(0, -5);
    const config = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    const declarations = config.usingComponents || {};
    assert.deepEqual(Object.keys(declarations).sort(), componentTags(template).sort(),
      path.relative(root, template) + ': missing or unused component declaration');
    for (const [name, reference] of Object.entries(declarations)) {
      const target = reference.startsWith('/') ? path.join(root, reference.slice(1)) :
        path.resolve(path.dirname(template), reference);
      for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
        assert(fs.existsSync(target + extension), `${name}: missing ${target + extension}`);
      }
      assert.equal(JSON.parse(fs.readFileSync(target + '.json', 'utf8')).component, true);
    }
  }
  console.log(`Checked component declarations in ${templates.length} templates`);
});

test('lazy component graph is acyclic and every registered page resolves', () => {
  function visit(base, ancestors = []) {
    assert(!ancestors.includes(base), 'Circular component dependency: ' + base);
    const config = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    for (const reference of Object.values(config.usingComponents || {})) {
      const target = reference.startsWith('/') ? path.join(root, reference.slice(1)) :
        path.resolve(path.dirname(base), reference);
      visit(target, [...ancestors, base]);
    }
  }
  for (const page of app.pages) visit(path.join(root, page));
});

test('local fallback covers and tab icons remain available at their original paths', () => {
  const { addRealCovers } = require('../utils/resources');
  const covers = addRealCovers(['卫生间', '阳台', '屋顶', '地下室', '定制'].map(name => ({ name })));
  const icons = app.tabBar.list.flatMap(tab => [tab.iconPath, tab.selectedIconPath]);
  for (const reference of [...covers.map(service => service.cover_image), ...icons]) {
    assert(reference, 'Missing local image reference');
    assert(fs.statSync(path.join(root, reference.replace(/^\//, ''))).size > 0, reference);
  }
});
