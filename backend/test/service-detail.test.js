const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture({ missing = false, fail = false } = {}) {
  const calls = [];
  const module = { exports: {} };
  const deps = {
    '../models/Service': {
      async getById(id) {
        calls.push(['getById', id]);
        if (fail) throw new Error('test database failure');
        return missing ? null : { id: 1, name: '平屋面防水', images: [] };
      },
      async incrementViewCount(id) { calls.push(['incrementViewCount', id]); }
    },
    '../config/database': { async query() { calls.push(['reviews']); return [[]]; } },
    '../utils/attachments': { async loadReviewImages() { return {}; }, signUrl: url => url }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/serviceController.js'), 'utf8'), {
    module, exports: module.exports, console: { error() {} },
    require(name) {
      assert.ok(Object.hasOwn(deps, name), `Unexpected dependency: ${name}`);
      return deps[name];
    }
  });
  return { controller: module.exports, calls };
}

async function request(f, id) {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await f.controller.getServiceById({ params: { id } }, res);
  return res;
}

test('invalid service IDs return 400 without looking up or modifying database data', async () => {
  for (const id of [undefined, null, '', 'undefined', 'null', 'NaN', '0', '-1', '1x', '1.5', '1e2', '1/2', ' 1', '01', true, [], {}, '9007199254740992']) {
    const f = fixture();
    const res = await request(f, id);
    assert.equal(res.statusCode, 400, String(id));
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '服务ID无效');
    assert.equal(f.calls.length, 0);
  }
});

test('valid service IDs still return details and reviews', async () => {
  const f = fixture();
  const res = await request(f, '1');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.id, 1);
  assert.equal(res.body.data.name, '平屋面防水');
  assert.equal(res.body.data.reviews.length, 0);
  assert.deepEqual(f.calls, [['getById', '1'], ['incrementViewCount', '1'], ['reviews']]);
});

test('a valid but missing or inactive service still returns 404', async () => {
  const f = fixture({ missing: true });
  const res = await request(f, '99999');
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, '服务不存在');
  assert.deepEqual(f.calls, [['getById', '99999']]);
});

test('database failures remain server errors, not missing-service errors', async () => {
  const f = fixture({ fail: true });
  const res = await request(f, '1');
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, '获取服务详情失败');
});
