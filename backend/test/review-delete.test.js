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
const plain = value => JSON.parse(JSON.stringify(value));
const FILE = n => `/api/upload/file/00000000-0000-0000-0000-00000000000${n}`;

function modelFixture({ reviews = [{ id: 7, video_url: FILE(9) }], images = [{ image_url: FILE(1) }, { image_url: FILE(2) }], missingTable = false, purge } = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
    async query(query, params) {
      events.push(query.split(' ').slice(0, 3).join(' '));
      if (query.startsWith('SELECT id, video_url FROM reviews')) return [reviews];
      if (query.startsWith('SELECT image_url FROM review_images')) {
        if (missingTable) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
        return [images];
      }
      return [{ affectedRows: reviews.length }];
    }
  };
  const purged = [];
  const errors = [];
  const WorkOrder = load('models/WorkOrder.js', { '../utils/orderChangeLog': require('../src/utils/orderChangeLog'),
    '../utils/orderNumber': {}, '../utils/orderWorkflow': {},
    '../utils/attachments': { presentOrder: o => o, assertOwned: async () => {}, loadReviewImages: async () => ({}), purgeUnreferenced: purge || (async urls => { events.push('purge'); purged.push(...urls); return urls.length; }) },
    '../config/database': { async getConnection() { return connection; } }
  }, { console: { error: (...args) => errors.push(args.join(' ')) } });
  return { WorkOrder, events, purged, errors };
}

test('deleting a review purges its video and images only after the transaction commits', async () => {
  const f = modelFixture();
  assert.equal(await f.WorkOrder.deleteReview(3, 5), true);
  assert.deepEqual(plain(f.purged), [FILE(9), FILE(1), FILE(2)]);
  assert.ok(f.events.indexOf('commit') < f.events.indexOf('purge'));
  assert.ok(f.events.includes('DELETE FROM reviews'));
  assert.equal(f.events.filter(e => e === 'release').length, 1);
});

test('deleting a review that does not exist returns false and purges nothing', async () => {
  const f = modelFixture({ reviews: [] });
  assert.equal(await f.WorkOrder.deleteReview(3, 5), false);
  assert.deepEqual(plain(f.purged), []);
  assert.ok(f.events.includes('rollback'));
  assert.ok(!f.events.includes('commit'));
  assert.ok(f.events.includes('release'));
});

test('a failing file purge is logged but does not turn a committed deletion into an error', async () => {
  const f = modelFixture({ purge: async () => { throw new Error('disk busy'); } });
  assert.equal(await f.WorkOrder.deleteReview(3, 5), true);
  assert.ok(f.events.includes('commit'));
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0], /disk busy/);
});

test('deleting an old video-only review still works before review_images exists', async () => {
  const f = modelFixture({ missingTable: true });
  assert.equal(await f.WorkOrder.deleteReview(3, 5), true);
  assert.deepEqual(plain(f.purged), [FILE(9)]);
});

test('a review without any attachment purges nothing harmful', async () => {
  const f = modelFixture({ reviews: [{ id: 7, video_url: null }], images: [] });
  assert.equal(await f.WorkOrder.deleteReview(3, 5), true);
  assert.deepEqual(plain(f.purged), []);
});

function attachmentsFixture(rows) {
  const queries = []; const removed = []; const deleted = [];
  const api = load('utils/attachments.js', {
    crypto: require('node:crypto'), path, '../config/database': {
      async query(query, params) {
        queries.push({ query, params });
        if (query.startsWith('SELECT u.id')) return [rows];
        if (query.startsWith('DELETE FROM uploads')) deleted.push(params[0]);
        return [[]];
      }
    },
    fs: { promises: { async rm(file, options) { removed.push({ file, options }); } } }
  });
  return { api, queries, removed, deleted };
}

test('purgeUnreferenced removes the file and the upload row of unreferenced private uploads', async () => {
  const f = attachmentsFixture([{ id: 'a', filename: 'a.png' }]);
  assert.equal(await f.api.purgeUnreferenced([FILE(1), FILE(1)]), 1);
  assert.deepEqual(plain(f.queries[0].params), [[FILE(1).split('/').pop()]]);
  assert.match(f.queries[0].query, /is_public=0/);
  for (const table of ['work_order_images', 'reviews', 'review_images']) assert.match(f.queries[0].query, new RegExp(`FROM ${table} `));
  assert.equal(f.removed.length, 1);
  assert.match(f.removed[0].file, /a\.png$/);
  assert.deepEqual(plain(f.deleted), ['a']);
});

test('purgeUnreferenced ignores invalid urls and does not query without valid ids', async () => {
  const f = attachmentsFixture([]);
  assert.equal(await f.api.purgeUnreferenced(['/uploads/legacy.png', 'https://x/y', null, 12, '../etc/passwd']), 0);
  assert.equal(await f.api.purgeUnreferenced([]), 0);
  assert.equal(f.queries.length, 0);
});

test('purgeUnreferenced leaves files that are still referenced elsewhere alone', async () => {
  const f = attachmentsFixture([]);
  assert.equal(await f.api.purgeUnreferenced([FILE(3)]), 0);
  assert.equal(f.removed.length, 0);
  assert.equal(f.deleted.length, 0);
});
