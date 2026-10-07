const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  parseHighlights,
  readHighlights,
  DEFAULT_HIGHLIGHTS,
  MAX_COUNT,
  MAX_LENGTH
} = require('../src/utils/serviceHighlights');

function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, console: { error() {} },
    require(name) {
      if (!(name in deps)) throw Error('Unexpected dependency: ' + name);
      return deps[name];
    }
  });
  return module.exports;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('empty highlights stay empty so the detail page can hide the section', () => {
  assert.deepEqual(parseHighlights(undefined), []);
  assert.deepEqual(parseHighlights(null), []);
  assert.deepEqual(parseHighlights(''), []);
  assert.deepEqual(parseHighlights([]), []);
});

test('highlights are trimmed, de-duplicated and keep the admin order', () => {
  assert.deepEqual(
    parseHighlights([' 质保5年 ', '免费勘测', '质保5年', '', '签约施工']),
    ['质保5年', '免费勘测', '签约施工']
  );
});

test('JSON strings and comma-separated text are accepted from older editors', () => {
  assert.deepEqual(parseHighlights('["质保5年","免费勘测"]'), ['质保5年', '免费勘测']);
  assert.deepEqual(parseHighlights('质保5年，免费勘测、签约施工'), ['质保5年', '免费勘测', '签约施工']);
});

test('an oversized chip or too many chips are rejected for admin writes', () => {
  assert.throws(() => parseHighlights(['啊'.repeat(MAX_LENGTH + 1)]), error => error.status === 400 && /不超过/.test(error.message));
  assert.throws(() => parseHighlights(Array.from({ length: MAX_COUNT + 1 }, (_, i) => `亮点${i}`)), error => error.status === 400 && /最多/.test(error.message));
  assert.throws(() => parseHighlights({ text: '质保5年' }), error => error.status === 400);
});

test('stored garbage does not break the public detail page', () => {
  assert.deepEqual(readHighlights('not-json {'), []);
  assert.deepEqual(readHighlights(['啊'.repeat(MAX_LENGTH + 1)]), []);
  assert.deepEqual(DEFAULT_HIGHLIGHTS, ['质保5年', '免费勘测', '签约施工']);
});

test('service detail parses stored highlights the same way images are parsed', async () => {
  const Service = load('models/Service.js', {
    '../config/database': {
      async query() {
        return [[{ id: 1, name: '卫生间免砸砖防水', images: '[]', highlights: '["质保5年","免费勘测"]' }]];
      }
    },
    '../utils/serviceHighlights': require('../src/utils/serviceHighlights')
  });
  const service = await Service.getById(1);
  assert.equal(JSON.stringify(service.highlights), JSON.stringify(['质保5年', '免费勘测']));
  assert.equal(JSON.stringify(service.images), '[]');
});

test('admin can create a service with highlights', async () => {
  const queries = [];
  const ContentController = load('controllers/contentController.js', {
    '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.includes('FROM service_categories')) return [[{ id: 2 }]];
        return [{ insertId: 9, affectedRows: 1 }];
      }
    },
    '../utils/operationLog': { logOperation() {} },
    '../utils/serviceHighlights': require('../src/utils/serviceHighlights')
  });
  const res = response();
  await ContentController.createService({
    user: { id: 1 },
    ip: '127.0.0.1',
    body: {
      category_id: 2,
      name: '卫生间免砸砖防水',
      highlights: ['质保5年', '免费勘测', '签约施工']
    }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  const insert = queries.find(item => item.sql.includes('INSERT INTO services'));
  assert.match(insert.sql, /highlights/);
  assert.equal(insert.params[5], JSON.stringify(['质保5年', '免费勘测', '签约施工']));
});

test('admin update rejects an oversized highlight without writing', async () => {
  const queries = [];
  const ContentController = load('controllers/contentController.js', {
    '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
    },
    '../utils/operationLog': { logOperation() {} },
    '../utils/serviceHighlights': require('../src/utils/serviceHighlights')
  });
  const res = response();
  await ContentController.updateService({
    user: { id: 1 },
    ip: '127.0.0.1',
    params: { id: '3' },
    body: { category_id: 2, name: '卫生间免砸砖防水', highlights: ['这是一个明显超过限制的服务亮点文案'] }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /不超过/);
  assert.equal(queries.length, 0);
});

test('omitting highlights on update leaves the stored chips unchanged', async () => {
  const queries = [];
  const ContentController = load('controllers/contentController.js', {
    '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
    },
    '../utils/operationLog': { logOperation() {} },
    '../utils/serviceHighlights': require('../src/utils/serviceHighlights')
  });
  const res = response();
  await ContentController.updateService({
    user: { id: 1 },
    ip: '127.0.0.1',
    params: { id: '3' },
    body: { category_id: 2, name: '卫生间免砸砖防水' }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(queries[0].sql, /highlights/);
});

test('admin service list returns highlights as an array', async () => {
  const ContentController = load('controllers/contentController.js', {
    '../config/database': {
      async query(sql) {
        if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
        return [[{ id: 1, name: '卫生间免砸砖防水', highlights: '["质保5年","签约施工"]' }]];
      }
    },
    '../utils/operationLog': { logOperation() {} },
    '../utils/serviceHighlights': require('../src/utils/serviceHighlights')
  });
  const res = response();
  await ContentController.getServices({ query: {} }, res);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.services[0].highlights, ['质保5年', '签约施工']);
});
