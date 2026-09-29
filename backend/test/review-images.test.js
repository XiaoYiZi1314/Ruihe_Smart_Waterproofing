const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load(file, deps, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, console, process: { env: { JWT_SECRET: 'test' } }, Buffer, __dirname: path.join(__dirname, '../src', path.dirname(file)), ...globals,
    require(name) { if (!(name in deps)) throw Error('Unexpected dependency: ' + name); return deps[name]; }
  });
  return module.exports;
}
// vm 沙箱里创建的数组/对象与测试上下文不是同一个 realm，按内容比较
const plain = value => JSON.parse(JSON.stringify(value));

const IMG = n => `/api/upload/file/00000000-0000-0000-0000-00000000000${n}`;

function fixture(orderOverrides = {}) {
  const sql = []; const owned = []; const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async query(query, params) {
      sql.push({ query, params });
      if (query.startsWith('SELECT worker_id')) return [[{ worker_id: 8, status: 'completed', review_submitted_at: null, ...orderOverrides }]];
      if (query.startsWith('INSERT INTO reviews')) return [{ insertId: 55 }];
      return [{}];
    }
  };
  const WorkOrder = load('models/WorkOrder.js', {
    '../utils/orderNumber': {}, '../utils/orderWorkflow': {},
    '../utils/attachments': { presentOrder: o => o, assertOwned: async (c, userId, urls, kind) => { owned.push({ urls, kind }); }, loadReviewImages: async () => ({}) },
    '../config/database': { async getConnection() { calls.push('getConnection'); return connection; } }
  });
  return { WorkOrder, sql, owned, calls };
}

const base = { service_attitude_score: 5, quality_score: 5, price_score: 5, comment: 'ok' };

test('review accepts up to 3 images and stores them in order', async () => {
  const f = fixture();
  await f.WorkOrder.submitReview(1, 7, { ...base, images: [IMG(1), IMG(2), IMG(3)] });
  const inserts = f.sql.filter(s => s.query.startsWith('INSERT INTO review_images'));
  assert.deepEqual(plain(inserts.map(s => s.params)), [[55, IMG(1), 0], [55, IMG(2), 1], [55, IMG(3), 2]]);
  assert.deepEqual(plain(f.owned), [{ urls: [IMG(1), IMG(2), IMG(3)], kind: 'image' }]);
  assert(f.calls.includes('commit'));
});

test('images and a video can be submitted together and are validated by kind', async () => {
  const f = fixture();
  await f.WorkOrder.submitReview(1, 7, { ...base, images: [IMG(1)], video_url: IMG(9) });
  assert.deepEqual(f.owned.map(o => o.kind).sort(), ['image', 'video']);
  assert.equal(f.sql.find(s => s.query.startsWith('INSERT INTO reviews')).params[7], IMG(9));
  assert(f.calls.includes('commit'));
});

test('a review without images still works (video only / text only)', async () => {
  const f = fixture();
  await f.WorkOrder.submitReview(1, 7, { ...base, video_url: IMG(9) });
  assert.equal(f.sql.some(s => s.query.startsWith('INSERT INTO review_images')), false);
  assert(f.calls.includes('commit'));
});

test('more than 3 images, duplicates or a non-array are rejected before touching the database', async () => {
  for (const images of [[IMG(1), IMG(2), IMG(3), IMG(4)], [IMG(1), IMG(1)], 'not-an-array', { 0: IMG(1) }]) {
    const f = fixture();
    await assert.rejects(f.WorkOrder.submitReview(1, 7, { ...base, images }), e => e.status === 400);
    assert.equal(f.calls.includes('getConnection'), false);
  }
});

test('an image that fails ownership validation rolls the whole review back', async () => {
  const f = fixture();
  const WorkOrder = load('models/WorkOrder.js', {
    '../utils/orderNumber': {}, '../utils/orderWorkflow': {},
    '../utils/attachments': { presentOrder: o => o, assertOwned: async () => { throw Object.assign(new Error('附件不属于当前用户或格式错误'), { status: 403 }); }, loadReviewImages: async () => ({}) },
    '../config/database': { async getConnection() { f.calls.push('getConnection'); return { async beginTransaction() {}, async commit() { f.calls.push('commit'); }, async rollback() { f.calls.push('rollback'); }, release() {},
      async query(q) { f.sql.push({ query: q }); return q.startsWith('SELECT worker_id') ? [[{ worker_id: 8, status: 'completed', review_submitted_at: null }]] : [{ insertId: 1 }]; } }; } }
  });
  await assert.rejects(WorkOrder.submitReview(1, 7, { ...base, images: [IMG(1)] }), e => e.status === 403);
  assert(f.calls.includes('rollback')); assert.equal(f.calls.includes('commit'), false);
  assert.equal(f.sql.some(s => s.query.startsWith('INSERT INTO reviews')), false);
});

test('getById attaches review images to the review', async () => {
  const queries = [];
  const Model = load('models/WorkOrder.js', {
    '../utils/orderNumber': {}, '../utils/orderWorkflow': {},
    '../utils/attachments': { presentOrder: o => o, assertOwned: async () => {}, loadReviewImages: async ids => ({ [ids[0]]: [{ id: 1, image_url: IMG(1) }] }) },
    '../config/database': { async query(q) { queries.push(q);
      if (q.includes('FROM work_orders wo')) return [[{ id: 42 }]];
      if (q.includes('work_order_images')) return [[]];
      if (q.includes('FROM reviews')) return [[{ id: 9, comment: 'good' }]];
      return [[]]; } }
  });
  const order = await Model.getById(42);
  assert.deepEqual(plain(order.review.images), [{ id: 1, image_url: IMG(1) }]);
});

test('presentOrder signs review images like other attachments', () => {
  const attachments = load('utils/attachments.js', { crypto: require('node:crypto'), '../config/database': {}, path, fs });
  const order = attachments.presentOrder({ review: { images: [{ id: 1, image_url: IMG(1) }], video_url: null } });
  assert.match(order.review.images[0].image_url, /\/api\/upload\/file\/.+\?expires=\d+&signature=[a-f0-9]{64}$/);
});

test('loadReviewImages groups by review and tolerates a missing table before migration', async () => {
  const rows = [{ id: 1, review_id: 9, image_url: IMG(1) }, { id: 2, review_id: 9, image_url: IMG(2) }, { id: 3, review_id: 10, image_url: IMG(3) }];
  const ok = load('utils/attachments.js', { crypto: require('node:crypto'), '../config/database': { async query() { return [rows]; } }, path, fs });
  const grouped = await ok.loadReviewImages([9, 10]);
  assert.deepEqual(plain(grouped[9].map(i => i.id)), [1, 2]); assert.deepEqual(plain(grouped[10].map(i => i.id)), [3]);
  assert.deepEqual(plain(await ok.loadReviewImages([])), {});
  const missing = load('utils/attachments.js', { crypto: require('node:crypto'), '../config/database': { async query() { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); } }, path, fs });
  assert.deepEqual(plain(await missing.loadReviewImages([9])), {});
  const broken = load('utils/attachments.js', { crypto: require('node:crypto'), '../config/database': { async query() { throw Object.assign(new Error('boom'), { code: 'ER_PARSE_ERROR' }); } }, path, fs });
  await assert.rejects(broken.loadReviewImages([9]), /boom/);
});
