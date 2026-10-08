const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function load(file, deps, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(read(file), {
    module, exports: module.exports, console, Promise, JSON, Object, Array, Error,
    require(name) { if (!(name in deps)) throw Error('Unexpected dependency: ' + name + ' in ' + file); return deps[name]; },
    ...globals
  });
  return module.exports;
}
function pageOf(file, deps, globals = {}) {
  let definition;
  load(file, deps, { Page: value => { definition = value; }, ...globals });
  return definition;
}
function instance(definition, data = {}) {
  const page = Object.create(definition);
  page.data = JSON.parse(JSON.stringify({ ...definition.data, ...data }));
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function storage(initial = {}) {
  const map = { ...initial };
  return { map, getStorageSync: key => map[key], setStorageSync: (key, value) => { map[key] = value; }, removeStorageSync: key => { delete map[key]; } };
}

// ---------- 登录：不再依赖 wx.getUserProfile ----------
test('login no longer uses the deprecated wx.getUserProfile and posts only the wx.login code', async () => {
  assert.doesNotMatch(read('pages/login/login.js'), /wx\.getUserProfile\s*\(/);
  assert.doesNotMatch(read('pages/login/login.wxml'), /onGetUserProfile/);
  assert.match(read('pages/login/login.wxml'), /bind:tap="onLogin"/);
  const posts = [];
  const auth = load('utils/auth.js', {
    './request': { post: async (url, data) => { posts.push({ url, data }); return { success: true, data: { token: 't', user: { id: 1 } } }; } },
    './session': { save() {} }
  }, { wx: { login: ({ success }) => success({ code: 'abc' }) } });
  await auth.login();
  assert.deepEqual(plain(posts), [{ url: '/api/auth/login', data: { code: 'abc' } }]);
});

function loginPage(user, { fail = false } = {}) {
  const calls = { reLaunch: [], navigateTo: [], toast: [], login: 0 };
  const timers = [];
  const store = storage();
  const guide = load('utils/profile-guide.js', {}, { wx: store });
  const definition = pageOf('pages/login/login.js', {
    '../../utils/auth': { checkLogin: () => false, login: async (...args) => { calls.login++; assert.equal(args.length, 0); if (fail) throw new Error('网络异常'); return { user }; } },
    '../../utils/request': {},
    '../../utils/session': { capture: () => ({}), isCurrent: () => true },
    '../../utils/profile-guide': guide
  }, {
    getApp: () => ({ sessionReady: Promise.resolve() }),
    wx: { ...store, showToast: o => calls.toast.push(o.title), reLaunch: o => { calls.reLaunch.push(o.url); if (o.success) o.success(); }, navigateTo: o => calls.navigateTo.push(o.url) },
    setTimeout: fn => timers.push(fn)
  });
  const page = instance(definition);
  return { page, calls, timers, store };
}
async function runLogin(ctx) {
  ctx.page.onLogin(); await tick(); await tick();
  ctx.timers.splice(0).forEach(fn => fn()); await tick();
}

test('a new customer with the default nickname is guided to the edit page once', async () => {
  const ctx = loginPage({ id: 7, role: 'customer', nickname: '微信用户' });
  await runLogin(ctx);
  assert.deepEqual(ctx.calls.reLaunch, ['/pages/index/index']);
  assert.deepEqual(ctx.calls.navigateTo, ['/pages/profile/edit?guide=1']);
  assert.equal(ctx.page.data.loading, false);
  // 第二次登录不再引导
  ctx.calls.reLaunch.length = 0; ctx.calls.navigateTo.length = 0;
  await runLogin(ctx);
  assert.deepEqual(ctx.calls.reLaunch, ['/pages/index/index']);
  assert.deepEqual(ctx.calls.navigateTo, []);
});

test('customers who already set a nickname are not guided', async () => {
  const ctx = loginPage({ id: 8, role: 'customer', nickname: '小瑞' });
  await runLogin(ctx);
  assert.deepEqual(ctx.calls.navigateTo, []);
});

test('login errors are shown and the button is released', async () => {
  const ctx = loginPage({}, { fail: true });
  ctx.page.onLogin();
  assert.equal(ctx.page.data.loading, true);
  await tick(); await tick();
  assert.equal(ctx.page.data.loading, false);
  assert.ok(ctx.calls.toast.includes('网络异常'));
  assert.deepEqual(ctx.calls.reLaunch, []);
});

// ---------- 编辑资料页 ----------
test('the edit page uses the official avatar and nickname capabilities and is registered', () => {
  const wxml = read('pages/profile/edit.wxml');
  assert.match(wxml, /open-type="chooseAvatar"/);
  assert.match(wxml, /bindchooseavatar="onChooseAvatar"/);
  assert.match(wxml, /type="nickname"/);
  assert.ok(JSON.parse(read('app.json')).pages.includes('pages/profile/edit'));
});

function editPage(user, { uploadFails = false, updateFails = false } = {}) {
  const calls = { upload: [], update: [], toast: [], saved: [], back: 0 };
  const timers = [];
  const store = storage({ token: 't', userInfo: user });
  const definition = pageOf('pages/profile/edit.js', {
    '../../utils/api': { updateProfile: async payload => { calls.update.push(plain(payload)); if (updateFails) throw new Error('x'); return { success: true, data: { ...user, ...payload, avatar_url: payload.avatar_url ? 'https://api.test' + payload.avatar_url : user.avatar_url } }; } },
    '../../utils/request': { upload: async (file, kind) => { calls.upload.push({ file, kind }); if (uploadFails) throw new Error('上传失败'); return '/uploads/11111111-1111-1111-1111-111111111111.jpg'; } },
    '../../utils/session': { updateUser: value => calls.saved.push(plain(value)) }
  }, {
    wx: { ...store, showToast: o => calls.toast.push(o.title), navigateBack: () => { calls.back++; }, reLaunch() {} },
    setTimeout: fn => timers.push(fn)
  });
  const page = instance(definition);
  page.onLoad({ guide: '1' });
  return { page, calls, timers, store };
}

test('onLoad: the default nickname is not prefilled and guide mode is read from the options', () => {
  const { page } = editPage({ id: 1, role: 'customer', nickname: '微信用户', avatar_url: '' });
  assert.equal(page.data.nickname, '');
  assert.equal(page.data.guide, true);
  assert.equal(page.data.isWorker, false);
  const named = editPage({ id: 1, role: 'customer', nickname: '小瑞', avatar_url: 'https://api.test/uploads/a.jpg' });
  assert.equal(named.page.data.nickname, '小瑞');
  assert.equal(named.page.data.avatarUrl, 'https://api.test/uploads/a.jpg');
});

test('saving uploads the chosen avatar as kind "avatar" first, then sends avatar and nickname together', async () => {
  const ctx = editPage({ id: 1, role: 'customer', nickname: '微信用户', avatar_url: '' });
  ctx.page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp_avatar.jpg' } });
  assert.equal(ctx.page.data.avatarUrl, 'wxfile://tmp_avatar.jpg');
  ctx.page.onNicknameInput({ detail: { value: '  小瑞 ' } });
  await ctx.page.onSave();
  assert.deepEqual(ctx.calls.upload, [{ file: 'wxfile://tmp_avatar.jpg', kind: 'avatar' }]);
  assert.deepEqual(ctx.calls.update, [{ nickname: '小瑞', avatar_url: '/uploads/11111111-1111-1111-1111-111111111111.jpg' }]);
  assert.equal(ctx.calls.saved.length, 1);
  assert.equal(ctx.calls.saved[0].nickname, '小瑞');
  assert.equal(ctx.calls.saved[0].avatar_url, 'https://api.test/uploads/11111111-1111-1111-1111-111111111111.jpg');
  assert.equal(ctx.page.data.avatarTemp, '');
  assert.equal(ctx.page.data.saving, false);
  assert.ok(ctx.calls.toast.includes('已保存'));
  ctx.timers.splice(0).forEach(fn => fn());
  assert.equal(ctx.calls.back, 1);
});

test('only changed fields are sent and nothing is requested when nothing changed', async () => {
  const ctx = editPage({ id: 1, role: 'customer', nickname: '小瑞', avatar_url: '' });
  ctx.page.onNicknameInput({ detail: { value: '小瑞' } });
  await ctx.page.onSave();
  assert.equal(ctx.calls.upload.length + ctx.calls.update.length, 0);
  assert.ok(ctx.calls.toast.includes('没有需要保存的修改'));
  ctx.page.onNicknameInput({ detail: { value: '小瑞2' } });
  await ctx.page.onSave();
  assert.deepEqual(ctx.calls.update, [{ nickname: '小瑞2' }]);
  assert.equal(ctx.calls.upload.length, 0);
});

test('a worker only changes the avatar and never sends a nickname', async () => {
  const ctx = editPage({ id: 2, role: 'worker', nickname: '张师傅', avatar_url: '' });
  assert.equal(ctx.page.data.isWorker, true);
  assert.equal(ctx.page.data.nickname, '张师傅');
  ctx.page.onNicknameInput({ detail: { value: '乱改' } });
  await ctx.page.onSave();
  assert.equal(ctx.calls.update.length, 0);
  ctx.page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://w.jpg' } });
  await ctx.page.onSave();
  assert.deepEqual(Object.keys(ctx.calls.update[0]), ['avatar_url']);
});

test('a failed upload keeps the draft, skips the profile call and releases the button', async () => {
  const ctx = editPage({ id: 1, role: 'customer', nickname: '微信用户', avatar_url: '' }, { uploadFails: true });
  ctx.page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.jpg' } });
  await ctx.page.onSave();
  assert.equal(ctx.calls.update.length, 0);
  assert.equal(ctx.page.data.avatarTemp, 'wxfile://tmp.jpg');
  assert.equal(ctx.page.data.saving, false);
  assert.equal(ctx.calls.saved.length, 0);
});

test('a second tap while saving is ignored', async () => {
  const ctx = editPage({ id: 1, role: 'customer', nickname: '微信用户', avatar_url: '' });
  ctx.page.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp.jpg' } });
  const first = ctx.page.onSave();
  await ctx.page.onSave();
  await first;
  assert.equal(ctx.calls.upload.length, 1);
});

// ---------- 入口与展示 ----------
test('customer and worker profile pages link to the edit page', () => {
  assert.match(read('pages/profile/index.wxml'), /bindtap="onEditProfile"/);
  assert.match(read('pages/profile/index.js'), /\/pages\/profile\/edit/);
  assert.match(read('pages/worker/profile/index.wxml'), /bindtap="goEditProfile"/);
  assert.match(read('pages/worker/profile/index.js'), /goEditProfile\(\)\s*\{\s*wx\.navigateTo\(\{ url: '\/pages\/profile\/edit' \}\)/);
});
test('worker profile forces password change only on first login', () => {
  const wxml = read('pages/worker/profile/index.wxml');
  const js = read('pages/worker/profile/index.js');
  assert.match(wxml, /wx:if="\{\{userInfo\.must_change_password\}\}"/);
  assert.match(wxml, /首次登录修改密码/);
  assert.match(wxml, /<rh-menu-item\b[^>]*bind:select="openPasswordModal"/);
  assert.match(wxml, /wx:if="\{\{showPasswordModal\}\}"/);
  assert.match(js, /firstLogin/);
  assert.match(js, /\/pages\/worker\/orders\/list/);
});

test('worker workbench and profile use a bottom tab bar like the customer app', () => {
  const list = read('pages/worker/orders/list.wxml');
  const profile = read('pages/worker/profile/index.wxml');
  assert.equal(list.includes('worker-toolbar'), false);
  assert.equal(list.includes('个人中心'), false);
  assert.match(list, /<rh-worker-tabbar\b[^>]*active="orders"/);
  assert.equal(profile.includes('工单工作台'), false);
  assert.match(profile, /<rh-worker-tabbar\b[^>]*active="profile"/);
  assert.match(profile, /wx:else>[\s\S]*rh-worker-tabbar/);
  assert.match(read('pages/worker/orders/list.js'), /onWorkerNav/);
  assert.match(read('pages/worker/profile/index.js'), /onWorkerNav/);
});

test('startup refresh completes relative avatar addresses like request.js does', async () => {
  const saved = [];
  let definition;
  load('app.js', {
    './utils/session': { capture: () => ({ token: 't' }), isCurrent: () => true, updateUser: user => saved.push(plain(user)) },
    './utils/environment': { getApiBaseUrl: () => 'https://api.test' }
  }, {
    App: value => { definition = value; }, getCurrentPages: () => [],
    wx: { request: ({ success }) => success({ statusCode: 200, data: { success: true, data: { id: 1, role: 'customer', avatar_url: '/uploads/a.jpg' } } }), reLaunch() {} }
  });
  const app = { globalData: { apiBaseUrl: 'https://api.test' } };
  assert.equal(await definition.checkToken.call(app), true);
  assert.equal(saved[0].avatar_url, 'https://api.test/uploads/a.jpg');
  // WeChat CDN 头像保持原样
  saved.length = 0;
  const cdn = load('app.js', {
    './utils/session': { capture: () => ({ token: 't' }), isCurrent: () => true, updateUser: user => saved.push(plain(user)) },
    './utils/environment': { getApiBaseUrl: () => 'https://api.test' }
  }, { App: value => { definition = value; }, getCurrentPages: () => [], wx: { request: ({ success }) => success({ statusCode: 200, data: { success: true, data: { id: 1, avatar_url: 'https://thirdwx.qlogo.cn/x/132' } } }), reLaunch() {} } });
  await definition.checkToken.call(app);
  assert.equal(saved[0].avatar_url, 'https://thirdwx.qlogo.cn/x/132');
});
