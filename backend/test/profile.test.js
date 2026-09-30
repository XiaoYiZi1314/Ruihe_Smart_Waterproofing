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
const ID = '11111111-1111-1111-1111-111111111111';
const AVATAR = `/uploads/${ID}.jpg`;
const OLD = '/uploads/22222222-2222-2222-2222-222222222222.png';

function controller({ user, owned = true, purge } = {}) {
  const queries = []; const purged = []; const errors = [];
  const current = { id: 5, role: 'customer', nickname: '微信用户', avatar_url: OLD, phone: null, created_at: 'x', status: 'active', ...user };
  let saved = { ...current };
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT id FROM uploads')) return [owned ? [{ id: params[0] }] : []];
      if (sql.startsWith('UPDATE users SET')) {
        const assignments = sql.slice('UPDATE users SET '.length, sql.indexOf(', updated_at')).split(', ');
        assignments.forEach((assignment, index) => { saved[assignment.replace('=?', '')] = params[index]; });
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };
  const api = load('controllers/authController.js', {
    bcryptjs: {}, '../models/User': { async findById() { return saved; } }, '../config/database': db,
    '../utils/jwt': {}, '../utils/workerLoginLookup': {}, '../utils/wechatIdentity': {}, '../utils/operationLog': {},
    '../utils/attachments': { purgePublicAvatar: purge || (async (url, userId) => { purged.push({ url, userId }); return true; }) }
  }, { console: { error: (...args) => errors.push(args.join(' ')) } });
  return { api, queries, purged, errors, current };
}
async function call(f, body) {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await f.api.updateProfile({ user: f.current, body }, res);
  return res;
}
const updates = f => f.queries.filter(q => q.sql.startsWith('UPDATE users SET'));

test('a customer can change nickname and avatar; the old avatar is recycled afterwards', async () => {
  const f = controller();
  const res = await call(f, { nickname: '  小瑞  ', avatar_url: AVATAR });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.nickname, '小瑞');
  assert.equal(res.body.data.avatar_url, AVATAR);
  assert.equal(updates(f).length, 1);
  assert.deepEqual(plain(f.purged), [{ url: OLD, userId: 5 }]);
});

test('the avatar must be an own, public image upload', async () => {
  const f = controller();
  const res = await call(f, { avatar_url: AVATAR });
  assert.equal(res.statusCode, 200);
  const check = f.queries.find(q => q.sql.startsWith('SELECT id FROM uploads'));
  assert.match(check.sql, /user_id=\?/); assert.match(check.sql, /is_public=1/); assert.match(check.sql, /image\//);
  assert.deepEqual(plain(check.params), [ID, 5]);

  const other = controller({ owned: false });
  const denied = await call(other, { avatar_url: AVATAR });
  assert.equal(denied.statusCode, 403);
  assert.equal(updates(other).length, 0);
  assert.equal(other.purged.length, 0);
});

test('avatar addresses that are not own public uploads are rejected before any query', async () => {
  for (const avatar_url of ['https://evil.example/a.png', '/api/upload/file/' + ID, '/uploads/../../etc/passwd', `/uploads/${ID}.mp4`, `/uploads/${ID}.jpg?x=1`, 12, '']) {
    const f = controller();
    const res = await call(f, { avatar_url });
    assert.equal(res.statusCode, 400, String(avatar_url));
    assert.equal(f.queries.length, 0);
  }
});

test('nickname must be 1-20 visible characters', async () => {
  for (const nickname of ['', '   ', 'x'.repeat(21), 'a\nb', 123, null]) {
    const f = controller();
    const res = await call(f, { nickname });
    assert.equal(res.statusCode, 400, String(nickname));
    assert.equal(updates(f).length, 0);
  }
  const f = controller();
  assert.equal((await call(f, { nickname: '瑞'.repeat(20) })).statusCode, 200);
});

test('a worker can change the avatar but not the nickname', async () => {
  const f = controller({ user: { role: 'worker', nickname: '张师傅' } });
  const denied = await call(f, { nickname: '改名' });
  assert.equal(denied.statusCode, 403);
  assert.equal(updates(f).length, 0);
  const ok = await call(f, { avatar_url: AVATAR });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.nickname, '张师傅');
  assert.equal(ok.body.data.avatar_url, AVATAR);
});

test('avatar can be cleared with null, and an empty request is rejected', async () => {
  const f = controller();
  const res = await call(f, { avatar_url: null });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.avatar_url, null);
  assert.deepEqual(plain(f.purged), [{ url: OLD, userId: 5 }]);
  const empty = controller();
  assert.equal((await call(empty, {})).statusCode, 400);
  assert.equal(updates(empty).length, 0);
});

test('saving the same avatar again does not recycle it', async () => {
  const f = controller({ user: { avatar_url: AVATAR } });
  assert.equal((await call(f, { avatar_url: AVATAR })).statusCode, 200);
  assert.equal(f.purged.length, 0);
});

test('a failing recycle of the old avatar never fails the saved profile', async () => {
  const f = controller({ purge: async () => { throw new Error('disk busy'); } });
  const res = await call(f, { avatar_url: AVATAR });
  assert.equal(res.statusCode, 200);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0], /disk busy/);
});

function attachments(rows) {
  const queries = []; const removed = []; const deleted = [];
  const api = load('utils/attachments.js', {
    crypto: require('node:crypto'), path, '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.startsWith('SELECT u.id')) return [rows];
        if (sql.startsWith('DELETE FROM uploads')) deleted.push(params[0]);
        return [[]];
      }
    },
    fs: { promises: { async rm(file) { removed.push(file); } } }
  });
  return { api, queries, removed, deleted };
}

test('purgePublicAvatar only touches an own public upload that nobody uses any more', async () => {
  const f = attachments([{ id: '22222222-2222-2222-2222-222222222222', filename: '22222222-2222-2222-2222-222222222222.png' }]);
  assert.equal(await f.api.purgePublicAvatar(OLD, 5), true);
  assert.match(f.queries[0].sql, /u\.user_id=\?/); assert.match(f.queries[0].sql, /is_public=1/); assert.match(f.queries[0].sql, /FROM users x WHERE x\.avatar_url=/);
  assert.deepEqual(plain(f.queries[0].params), ['22222222-2222-2222-2222-222222222222', 5]);
  assert.match(f.removed[0], /uploads[\\/]22222222-2222-2222-2222-222222222222\.png$/);
  assert.deepEqual(plain(f.deleted), ['22222222-2222-2222-2222-222222222222']);
});

test('purgePublicAvatar ignores WeChat CDN avatars and other addresses without querying', async () => {
  const f = attachments([]);
  for (const url of ['https://thirdwx.qlogo.cn/mmopen/vi_32/x/132', null, '', '/api/upload/file/' + ID, '/uploads/../x.png']) assert.equal(await f.api.purgePublicAvatar(url, 5), false);
  assert.equal(f.queries.length, 0);
  const gone = attachments([]);
  assert.equal(await gone.api.purgePublicAvatar(OLD, 5), false);
  assert.equal(gone.removed.length, 0);
});

test('cleanupAvatarOrphans is limited to customer/worker uploads so admin covers and banners are safe', async () => {
  const f = attachments([{ id: 'a', filename: 'a.jpg' }, { id: 'b', filename: 'b.png' }]);
  assert.equal(await f.api.cleanupAvatarOrphans(), 2);
  const sql = f.queries[0].sql;
  assert.match(sql, /owner\.role IN \('customer','worker'\)/);
  assert.match(sql, /is_public=1/);
  assert.match(sql, /INTERVAL 1 DAY/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM users x WHERE x\.avatar_url=CONCAT\('\/uploads\/',u\.filename\)\)/);
  assert.deepEqual(plain(f.deleted), ['a', 'b']);
});

test('routes: avatar upload is public and profile update is limited to customers and workers', () => {
  const upload = fs.readFileSync(path.join(__dirname, '../src/routes/upload.js'), 'utf8');
  assert.match(upload, /router\.post\('\/avatar', authenticateToken, \.\.\.uploadHandler\('image', true\)\)/);
  const auth = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8');
  assert.match(auth, /router\.put\('\/profile', authenticateToken, requireRole\(\['customer', 'worker'\]\), authController\.updateProfile\)/);
  const scheduler = fs.readFileSync(path.join(__dirname, '../src/jobs/scheduler.js'), 'utf8');
  assert.match(scheduler, /cleanupAvatarOrphans/);
});
