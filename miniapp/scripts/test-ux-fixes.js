const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---- 最小小程序运行环境：记录 toast / 跳转，按需注入依赖 ----
function createEnv({ token = 'tok', user = { role: 'customer' }, deps = {}, confirm = true } = {}) {
  const store = new Map(token ? [['token', token], ['userInfo', user]] : []);
  const calls = { toast: [], navigateTo: [], redirectTo: [], reLaunch: [], switchTab: [], navigateBack: 0, modal: [], stopPull: 0, clipboard: [] };
  const timers = [];
  const app = { globalData: {}, sessionReady: Promise.resolve(true) };
  const env = { store, calls, timers, app, confirm, requests: [], definitions: {} };
  const wx = {
    getStorageSync: (key) => store.get(key),
    setStorageSync: (key, value) => store.set(key, value),
    removeStorageSync: (key) => store.delete(key),
    showToast: (options) => calls.toast.push(options.title),
    showLoading() {}, hideLoading() {},
    stopPullDownRefresh: () => { calls.stopPull += 1; },
    navigateTo: (options) => calls.navigateTo.push(options.url),
    redirectTo: (options) => calls.redirectTo.push(options.url),
    reLaunch: (options) => calls.reLaunch.push(options.url),
    switchTab: (options) => calls.switchTab.push(options.url),
    navigateBack: () => { calls.navigateBack += 1; },
    setClipboardData: (options) => { calls.clipboard.push(options.data); if (options.success) options.success(); },
    showModal: (options) => {
      calls.modal.push(options);
      Promise.resolve().then(() => options.success && options.success({ confirm: env.confirm }));
    },
    request: (options) => env.requests.push(options),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } })
  };
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    vm.runInNewContext(fs.readFileSync(absolute, 'utf8'), {
      module, exports: module.exports, console: { log() {}, error() {} }, wx,
      getApp: () => app, getCurrentPages: () => [],
      setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
      Page: (definition) => { env.lastPage = definition; },
      Component: (definition) => { env.lastComponent = definition; },
      require: (name) => {
        if (Object.prototype.hasOwnProperty.call(deps, name)) return deps[name];
        if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), `${name}.js`)));
        return require(name);
      }
    }, { filename: file });
    return module.exports;
  }
  function setPath(target, key, value) {
    const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
    let node = target;
    parts.slice(0, -1).forEach((part) => { node = node[part]; });
    node[parts[parts.length - 1]] = value;
  }
  env.page = (file) => {
    load(file);
    const definition = env.lastPage;
    const page = Object.create(definition);
    page.data = plain(definition.data || {});
    page.setData = function (patch) { Object.entries(patch).forEach(([key, value]) => setPath(this.data, key, value)); };
    return page;
  };
  env.component = (file) => { load(file); return env.lastComponent; };
  env.load = load;
  env.runTimers = () => timers.splice(0).forEach((fn) => fn());
  return env;
}

const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

// ---------------------------------------------------------------- 预约时段
test('booking slots: past slots are hidden for today, everything else stays available', () => {
  const slots = createEnv().load('miniapp/utils/booking-slots.js');
  const at = (hour, minute) => new Date(2026, 9, 1, hour, minute);
  const values = (list) => plain(list.map((item) => item.value));

  assert.deepEqual(values(slots.availableSlots('2026-10-01', at(8, 0))), ['上午 08-12', '下午 13-18', '晚上 18-20']);
  assert.deepEqual(values(slots.availableSlots('2026-10-01', at(14, 30))), ['下午 13-18', '晚上 18-20']);
  assert.deepEqual(values(slots.availableSlots('2026-10-01', at(17, 0))), ['下午 13-18', '晚上 18-20'], 'exactly one hour before the end is still allowed');
  assert.deepEqual(values(slots.availableSlots('2026-10-01', at(17, 1))), ['晚上 18-20']);
  assert.deepEqual(values(slots.availableSlots('2026-10-01', at(19, 10))), []);
  assert.equal(slots.availableSlots('2026-10-02', at(19, 10)).length, 3, 'other days are never restricted');
  assert.equal(slots.isSlotAvailable('2026-10-01', '上午 08-12', at(14, 30)), false);
  assert.equal(slots.isSlotAvailable('2026-10-01', '下午 13-18', at(14, 30)), true);

  assert.equal(slots.pickTime('2026-10-01', '上午 08-12', at(14, 30)), '下午 13-18', 'an expired choice falls back to the first valid slot');
  assert.equal(slots.pickTime('2026-10-01', '晚上 18-20', at(14, 30)), '晚上 18-20', 'a valid choice is kept');
});

test('booking slots: date options start tomorrow once today has no slot left', () => {
  const slots = createEnv().load('miniapp/utils/booking-slots.js');
  const morning = plain(slots.buildDateOptions(new Date(2026, 9, 1, 9, 0)));
  assert.equal(morning.length, 5);
  assert.deepEqual(morning.slice(0, 3), [
    { value: '2026-10-01', label: '今天' }, { value: '2026-10-02', label: '明天' }, { value: '2026-10-03', label: '10-03' }
  ]);
  const night = plain(slots.buildDateOptions(new Date(2026, 9, 1, 19, 30)));
  assert.equal(night.length, 5);
  assert.deepEqual(night[0], { value: '2026-10-02', label: '明天' }, 'labels stay relative to the real today');
  // 跨月
  assert.equal(plain(slots.buildDateOptions(new Date(2026, 8, 30, 9, 0)))[1].value, '2026-10-01');
});

test('booking slots: the slot stored in remark can be read back', () => {
  const slots = createEnv().load('miniapp/utils/booking-slots.js');
  assert.equal(slots.extractSlot('预约时间：2026-10-01 上午 08-12\n墙面渗水'), '2026-10-01 上午 08-12');
  assert.equal(slots.extractSlot('只有备注'), '');
  assert.equal(slots.extractSlot(null), '');
});

test('booking form validates phone format, name length and stale slots before any upload', () => {
  const env = createEnv();
  const page = env.page('miniapp/pages/booking/create.js');
  page.data.selectedAddress = { id: 1 };
  page.data.contactName = '张三';
  page.data.dateValue = '2999-01-01';
  page.data.timeValue = '上午 08-12';

  page.data.contactPhone = '12345';
  assert.equal(page.validateForm(), false);
  assert.equal(env.calls.toast.pop(), '请输入正确的11位手机号');

  page.data.contactPhone = '  13800138000 ';
  page.data.contactName = '名'.repeat(21);
  assert.equal(page.validateForm(), false);
  assert.equal(env.calls.toast.pop(), '姓名不能超过20个字符');

  page.data.contactName = '张三';
  assert.equal(page.validateForm(), true, 'surrounding spaces are tolerated');

  // 今天的时段已过：拒绝并把选项刷新为可用值
  const slots = env.load('miniapp/utils/booking-slots.js');
  page.data.dateValue = slots.formatDate(new Date());
  page.data.timeValue = '不存在的时段';
  assert.equal(page.validateForm(), false);
  assert.equal(env.calls.toast.pop(), '所选时段已过，请重新选择预约时间');
  assert.ok(slots.isSlotAvailable(page.data.dateValue, page.data.timeValue));
});

test('booking page sends guests to login and comes back afterwards', () => {
  const env = createEnv({ token: null, deps: { '../../utils/notifications': { loadConfig() {} } } });
  const page = env.page('miniapp/pages/booking/create.js');
  page.onLoad({ serviceId: '7' });
  assert.deepEqual(env.calls.redirectTo, [`/pages/login/login?redirect=${encodeURIComponent('/pages/booking/create?serviceId=7')}`]);
});

// ---------------------------------------------------------------- 登录与游客
test('requireLogin only interrupts guests and remembers where they were going', () => {
  const guest = createEnv({ token: null });
  assert.equal(guest.load('miniapp/utils/auth.js').requireLogin('/pages/orders/list'), false);
  assert.deepEqual(guest.calls.navigateTo, ['/pages/login/login?redirect=%2Fpages%2Forders%2Flist']);

  const member = createEnv();
  assert.equal(member.load('miniapp/utils/auth.js').requireLogin('/pages/orders/list'), true);
  assert.deepEqual(member.calls.navigateTo, []);
});

test('guests can open the home page and only booking asks them to log in', async () => {
  const api = {
    getBanners: async () => ({ success: true, data: [] }),
    getServices: async () => ({ success: true, data: [{ id: 3, name: '防水', category_id: 1 }] }),
    getCategories: async () => ({ success: true, data: [] }),
    getConfig: async () => ({ success: true, data: {} })
  };
  const env = createEnv({ token: null, deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/index/index.js');
  page.onShow();
  await tick(); await tick();
  assert.deepEqual(env.calls.reLaunch, [], 'no forced redirect to the login page');
  assert.equal(page.data.services.length, 1);

  page.onBookTap({ detail: { service: { id: 3 } } });
  assert.deepEqual(env.calls.navigateTo, [`/pages/login/login?redirect=${encodeURIComponent('/pages/booking/create?serviceId=3')}`]);
});

test('home page shows a retry state instead of an empty list when loading fails', async () => {
  const fail = async () => { throw new Error('network'); };
  const env = createEnv({ deps: { '../../utils/api': { getBanners: fail, getServices: fail, getCategories: fail, getConfig: fail } } });
  const page = env.page('miniapp/pages/index/index.js');
  page.onShow();
  await tick(); await tick();
  assert.equal(page.data.loadFailed, true);
  assert.equal(page.data.loading, false);
  assert.match(read('miniapp/pages/index/index.wxml'), /loadFailed[^"]*"[^>]*action-text="重新加载"/);
});

test('profile header contains only real account information', () => {
  const markup = read('miniapp/pages/profile/index.wxml');
  const styles = read('miniapp/pages/profile/index.wxss');
  assert.doesNotMatch(markup, /认证会员|享专属服务保障|查看权益|profile-vip|未绑定手机号/);
  assert.match(markup, /wx:if="\{\{displayPhone\}\}" class="profile-phone"/);
  assert.doesNotMatch(styles, /profile-vip/);
});

test('about us uses a readable page instead of a system modal', async () => {
  assert.match(read('miniapp/app.json'), /pages\/about\/index/);
  assert.match(read('miniapp/pages/about/index.wxss'), /white-space:\s*pre-line/);
  assert.match(read('miniapp/pages/index/index.wxss'), /white-space:\s*pre-line/);
  assert.doesNotMatch(read('miniapp/pages/index/index.js'), /showModal/);
  assert.doesNotMatch(read('miniapp/pages/profile/index.js'), /showModal\(\{\s*title:\s*'关于我们'/);

  const homeEnv = createEnv();
  const homePage = homeEnv.page('miniapp/pages/index/index.js');
  homePage.goAbout();
  assert.deepEqual(homeEnv.calls.navigateTo, ['/pages/about/index']);
  homePage.onQuickTap({ detail: { key: 'about' } });
  assert.deepEqual(homeEnv.calls.navigateTo, ['/pages/about/index', '/pages/about/index']);

  const profileEnv = createEnv();
  const profile = profileEnv.page('miniapp/pages/profile/index.js');
  profile.showAbout();
  assert.deepEqual(profileEnv.calls.navigateTo, ['/pages/about/index']);

  const api = { getConfig: async () => ({ success: true, data: { about_us: '第一段\n\n第二段', contact_info: { phone: '13306944888', address: '漳浦', hours: '8:00-20:00' } } }) };
  const aboutEnv = createEnv({ deps: { '../../utils/api': api } });
  const about = aboutEnv.page('miniapp/pages/about/index.js');
  await about.load();
  assert.equal(about.data.aboutUs, '第一段\n\n第二段');
  assert.equal(about.data.contact.phone, '13306944888');
  assert.equal(about.data.loading, false);
});

test('login redirects back to the page the guest came from, and ignores unsafe targets', async () => {
  const run = async (redirect, user = { id: 1, role: 'customer', nickname: '张三' }) => {
    const env = createEnv({ token: null, deps: {
      '../../utils/auth': { checkLogin: () => false, login: async () => ({ user }) },
      '../../utils/request': {},
      '../../utils/session': { capture: () => ({}), isCurrent: () => true },
      '../../utils/profile-guide': { consume: () => false }
    } });
    env.store.set('userInfo', user);
    const page = env.page('miniapp/pages/login/login.js');
    page.onLoad({ redirect });
    page.onLogin();
    await tick(); await tick();
    env.runTimers();
    await tick();
    return env.calls;
  };

  const booking = await run(encodeURIComponent('/pages/booking/create?serviceId=3'));
  assert.deepEqual(booking.redirectTo, ['/pages/booking/create?serviceId=3']);
  assert.deepEqual(booking.reLaunch, []);

  const tab = await run(encodeURIComponent('/pages/orders/list'));
  assert.deepEqual(tab.switchTab, ['/pages/orders/list']);

  for (const unsafe of ['https://evil.example.com', '//evil.example.com', '/pages/worker/orders/list', '/pages/login/login', '%E0%A4%A']) {
    const result = await run(unsafe);
    assert.deepEqual(result.redirectTo, [], `ignored: ${unsafe}`);
    assert.deepEqual(result.reLaunch, ['/pages/index/index'], `falls back to home: ${unsafe}`);
  }
});

test('login page explains why the user was sent back after a session expired', () => {
  const env = createEnv({ token: null });
  const page = env.page('miniapp/pages/login/login.js');
  env.app.globalData.loginNotice = '登录已过期，请重新登录';
  page.onShow();
  assert.deepEqual(env.calls.toast, ['登录已过期，请重新登录']);
  page.onShow();
  assert.equal(env.calls.toast.length, 1, 'the notice is shown once');
});

test('an expired session leaves a notice for the login page', async () => {
  const env = createEnv({ token: 'old' });
  const request = env.load('miniapp/utils/request.js');
  const pending = request.get('/api/orders');
  env.requests[0].success({ statusCode: 401, data: { message: '未授权' } });
  await assert.rejects(pending);
  assert.equal(env.app.globalData.loginNotice, '登录已过期，请重新登录');
  assert.deepEqual(env.calls.reLaunch, ['/pages/login/login']);
});

test('app entry page is the home page so guests can browse first', () => {
  const app = JSON.parse(read('miniapp/app.json'));
  assert.equal(app.pages[0], 'pages/index/index');
  assert.ok(app.pages.includes('pages/login/login'));
});

test('profile tab shows a login entry for guests and guards login-only menu items', () => {
  const env = createEnv({ token: null });
  const page = env.page('miniapp/pages/profile/index.js');
  page.onLoad();
  page.onShow();
  assert.equal(page.data.guest, true);
  assert.deepEqual(env.calls.reLaunch, []);

  page.onMenuTap({ currentTarget: { dataset: { id: 'orders' } } });
  page.onMenuTap({ currentTarget: { dataset: { id: 'address' } } });
  assert.deepEqual(env.calls.switchTab, []);
  assert.deepEqual(env.calls.navigateTo, [
    '/pages/login/login?redirect=%2Fpages%2Forders%2Flist',
    `/pages/login/login?redirect=${encodeURIComponent('/pages/address/list?mode=manage')}`
  ]);
});

// ---------------------------------------------------------------- 列表：分页、错误态、游客
test('services list retries the same page after a failed load-more instead of skipping it', async () => {
  const requested = [];
  let fail = true;
  const api = {
    getCategories: async () => ({ success: true, data: [] }),
    getServices: async (params) => {
      requested.push(params.page);
      if (fail) throw new Error('network');
      return { success: true, data: [{ id: 20 + params.page }], pagination: { page: params.page, pages: 3, total: 25 } };
    }
  };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/services/list.js');
  page.data.services = [{ id: 1 }];
  page.data.page = 1;
  page.data.hasMore = true;

  page.onReachBottom(); await tick(); await tick();
  assert.equal(page.data.page, 1, 'page is not advanced by a failed request');
  fail = false;
  page.onReachBottom(); await tick(); await tick();
  assert.deepEqual(requested, [2, 2]);
  assert.equal(page.data.page, 2);
  assert.equal(page.data.services.length, 2);
});

test('services list distinguishes a failed first load from an empty result', async () => {
  const api = { getCategories: async () => ({ success: true, data: [] }), getServices: async () => { throw new Error('network'); } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/services/list.js');
  await page.onShow();
  assert.equal(page.data.loadFailed, true);
  assert.match(read('miniapp/pages/services/list.wxml'), /loadFailed && services\.length === 0[^>]*action-text/);
});

test('orders list retries the same page after a failed load-more', async () => {
  const requested = [];
  let fail = true;
  const api = { getOrders: async (params) => {
    requested.push(params.page);
    if (fail) throw new Error('network');
    return { success: true, data: [{ id: 50 + params.page }], pagination: { page: params.page, pages: 2, total: 12 } };
  } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/orders/list.js');
  page.data.orders = [{ id: 1 }];
  page.data.hasMore = true;
  page.onReachBottom(); await tick(); await tick();
  assert.equal(page.data.page, 1);
  fail = false;
  page.onReachBottom(); await tick(); await tick();
  assert.deepEqual(requested, [2, 2]);
  assert.equal(page.data.page, 2);
});

test('orders list: price negotiating has its own tab and guests get a login entry without any request', () => {
  let requests = 0;
  const env = createEnv({ token: null, deps: { '../../utils/api': { getOrders: async () => { requests += 1; return { success: true, data: [] }; } } } });
  const page = env.page('miniapp/pages/orders/list.js');
  page.onLoad();
  assert.ok(plain(page.data.tabs).some((tab) => tab.key === 'price_negotiating' && tab.label === '价格协商中'));
  page.onShow();
  assert.equal(page.data.guest, true);
  assert.equal(requests, 0);
  page.onGoLogin();
  assert.deepEqual(env.calls.navigateTo, ['/pages/login/login?redirect=%2Fpages%2Forders%2Flist']);
  assert.match(read('miniapp/pages/orders/list.wxml'), /action-text="立即登录"/);
});

test('orders list ignores a second cancel tap while the first is still running', async () => {
  const gate = deferred();
  let cancels = 0;
  const api = { getOrders: async () => ({ success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } }), cancelOrder: async () => { cancels += 1; await gate.promise; return { success: true }; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/orders/list.js');
  page.data.orders = [{ id: 9 }];
  page.onOrderAction({ detail: { action: 'cancel', order: { id: 9 } } });
  page.onOrderAction({ detail: { action: 'cancel', order: { id: 9 } } });
  await tick(); await tick();
  assert.equal(cancels, 1);
  gate.resolve(); await tick(); await tick();
});

test('order detail explains authorization failures instead of calling them network failures', async () => {
  const error = Object.assign(new Error('无权查看此工单'), { type: 'http', statusCode: 403 });
  const api = { getOrderById: async () => { throw error; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/orders/detail.js');
  page.onLoad({ id: '11' });
  await tick(); await tick();
  assert.equal(page.data.loadErrorText, '无权查看此工单');
  assert.equal(page.data.loadFailed, true);
});

test('service detail distinguishes a missing service from a network failure', async () => {
  const error = Object.assign(new Error('服务不存在'), { type: 'http', statusCode: 404 });
  const api = { getServiceById: async () => { throw error; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/services/detail.js');
  page.onLoad({ id: '999' });
  await tick(); await tick();
  assert.equal(page.data.loadErrorText, '服务已下架或不存在');
  assert.equal(page.data.loadFailed, true);
});

test('orders list clears stale cards when the login session changes', () => {
  const env = createEnv();
  const page = env.page('miniapp/pages/orders/list.js');
  page.data.orders = [{ id: 12 }];
  page._sessionToken = 'tok';
  env.store.set('token', 'new-token');
  page.onShow();
  assert.equal(page.data.orders.length, 0);
  assert.equal(page.data.guest, false);
  page.onOrderTap({ detail: { order: { id: 12 } } });
  assert.deepEqual(env.calls.navigateTo, []);
});

// ---------------------------------------------------------------- 详情页：失败不再被踢出
test('order detail keeps the page when a refresh fails and offers a retry when the first load fails', async () => {
  let fail = true;
  const api = { getOrderById: async () => { if (fail) throw new Error('network'); return { success: true, data: { id: 1, status: 'pending', images: [] } }; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/orders/detail.js');
  page.onLoad({ id: '1' });
  await tick(); await tick();
  env.runTimers();
  assert.equal(page.data.loadFailed, true);
  assert.equal(page.data.loading, false);
  assert.equal(env.calls.navigateBack, 0, 'no automatic navigate back');

  fail = false;
  page.onRetryLoad(); await tick(); await tick();
  assert.equal(page.data.loadFailed, false);
  assert.equal(page.data.order.id, 1);

  fail = true;
  await page.loadOrderDetail('1');
  env.runTimers();
  assert.equal(page.data.order.id, 1, 'the loaded order stays on screen');
  assert.equal(page.data.loadFailed, false);
  assert.equal(env.calls.navigateBack, 0);
});

test('order detail keeps a slower successful load when a later overlapping request fails', async () => {
  const pending = [];
  const api = { getOrderById: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/orders/detail.js');
  page.orderId = '7';
  const first = page.loadOrderDetail('7');
  const second = page.loadOrderDetail('7');
  assert.equal(pending.length, 2);
  pending[0].resolve({ success: true, data: { id: 7, status: 'pending', images: [] } });
  pending[1].reject(new Error('aborted'));
  await first.catch(() => {});
  await second.catch(() => {});
  await tick(); await tick();
  assert.equal(page.data.order && page.data.order.id, 7);
  assert.equal(page.data.loadFailed, false);
  assert.equal(page.data.loading, false);
});

test('service detail keeps the page on failure, refreshes on pull-down and shares safely before loading', async () => {
  let fail = true;
  const api = { getServiceById: async () => { if (fail) throw new Error('network'); return { success: true, data: { id: 5, name: '屋面防水', price_min: 10, reviews: [] } }; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/services/detail.js');

  // 分享菜单在数据回来前就能打开：不能抛错
  assert.doesNotThrow(() => page.onShareAppMessage());
  page.onLoad({ id: '5' });
  assert.equal(page.onShareAppMessage().path, '/pages/services/detail?id=5');

  await tick(); await tick();
  env.runTimers();
  assert.equal(page.data.loadFailed, true);
  assert.equal(env.calls.navigateBack, 0);

  fail = false;
  page.onRetryLoad(); await tick(); await tick();
  assert.equal(page.data.service.name, '屋面防水');
  assert.equal(page.onShareAppMessage().title, '屋面防水');

  page.onPullDownRefresh(); await tick(); await tick();
  assert.equal(env.calls.stopPull, 1);
});

test('service detail keeps a slower successful load when a later overlapping request fails', async () => {
  const pending = [];
  const api = { getServiceById: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/services/detail.js');
  page.serviceId = '5';
  const first = page.loadServiceDetail('5');
  const second = page.loadServiceDetail('5');
  pending[0].resolve({ success: true, data: { id: 5, name: '屋面防水', price_min: 10, reviews: [] } });
  pending[1].reject(new Error('aborted'));
  await first.catch(() => {});
  await second.catch(() => {});
  await tick(); await tick();
  assert.equal(page.data.service && page.data.service.name, '屋面防水');
  assert.equal(page.data.loadFailed, false);
  assert.equal(page.data.loading, false);
});

const detailCases = [
  { name: 'service', file: 'miniapp/pages/services/detail.js', getter: 'getServiceById', loader: 'loadServiceDetail', property: 'service', record: { id: 7, name: '防水', price_min: 10, reviews: [] } },
  { name: 'order', file: 'miniapp/pages/orders/detail.js', getter: 'getOrderById', loader: 'loadOrderDetail', property: 'order', record: { id: 7, status: 'pending', images: [] } }
];
function detailFixture(spec) {
  const pending = [];
  const api = { [spec.getter]: () => { const gate = deferred(); pending.push(gate); return gate.promise; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page(spec.file);
  return { page, pending, load: () => page[spec.loader]('7'), response: () => ({ success: true, data: plain(spec.record) }) };
}

for (const spec of detailCases) {
  for (const code of [400, 401, 403, 404, 'session']) {
    for (const successFirst of [true, false]) {
      test(`${spec.name} detail: latest ${code} wins over an older success (${successFirst ? 'success first' : 'denial first'})`, async () => {
        const f = detailFixture(spec);
        const older = f.load();
        const latest = f.load();
        if (successFirst) { f.pending[0].resolve(f.response()); await older; }
        f.pending[1].reject(Object.assign(new Error('denied'), code === 'session' ? { type: 'session' } : { type: 'http', statusCode: code }));
        await latest;
        if (!successFirst) { f.pending[0].resolve(f.response()); await older; }
        assert.equal(f.page.data[spec.property], null);
        assert.equal(f.page.data.loading, false);
        assert.equal(f.page.data.loadFailed, true);
      });
    }
  }

  test(`${spec.name} detail: a definitive refresh failure clears loaded content and order modals`, async () => {
    const f = detailFixture(spec);
    const initial = f.load();
    f.pending[0].resolve(f.response());
    await initial;
    if (spec.name === 'order') f.page.setData({ showReviewModal: true, showDisputeModal: true });
    const refresh = f.load();
    f.pending[1].reject(Object.assign(new Error('denied'), { type: 'http', statusCode: 403 }));
    await refresh;
    assert.equal(f.page.data[spec.property], null);
    assert.equal(f.page.data.loadFailed, true);
    if (spec.name === 'order') {
      assert.equal(f.page.data.showReviewModal, false);
      assert.equal(f.page.data.showDisputeModal, false);
    }
  });

  test(`${spec.name} detail: latest successful content cannot be overwritten by an older success`, async () => {
    const f = detailFixture(spec);
    const older = f.load();
    const latest = f.load();
    const latestResponse = f.response();
    latestResponse.data.version = 'latest';
    f.pending[1].resolve(latestResponse);
    await latest;
    const oldResponse = f.response();
    oldResponse.data.version = 'old';
    f.pending[0].resolve(oldResponse);
    await older;
    assert.equal(f.page.data[spec.property].version, 'latest');
  });

  test(`${spec.name} detail: business failure response blocks older success too`, async () => {
    const f = detailFixture(spec);
    const older = f.load();
    const latest = f.load();
    f.pending[1].resolve({ success: false, message: '业务拒绝' });
    await latest;
    f.pending[0].resolve(f.response());
    await older;
    assert.equal(f.page.data[spec.property], null);
    assert.equal(f.page.data.loadFailed, true);
    assert.equal(f.page.data.loadErrorText, '业务拒绝');
  });

  test(`${spec.name} detail: starting a retry cannot revive a response from before denial`, async () => {
    const f = detailFixture(spec);
    const older = f.load();
    const latest = f.load();
    f.pending[1].reject(Object.assign(new Error('denied'), { type: 'http', statusCode: 403 }));
    await latest;
    const retry = f.load();
    f.pending[0].resolve(f.response());
    await older;
    assert.equal(f.page.data[spec.property], null);
    assert.equal(f.page.data.loading, true);
    f.pending[2].resolve(f.response());
    await retry;
    assert.equal(f.page.data[spec.property].id, 7);
    assert.equal(f.page.data.loadFailed, false);
  });

  for (const error of [Object.assign(new Error('offline'), { type: 'network' }), Object.assign(new Error('unavailable'), { type: 'http', statusCode: 503 })]) {
    test(`${spec.name} detail: older success still recovers after latest ${error.type}/${error.statusCode || ''}`, async () => {
      const f = detailFixture(spec);
      const older = f.load();
      const latest = f.load();
      f.pending[1].reject(error);
      await latest;
      f.pending[0].resolve(f.response());
      await older;
      assert.equal(f.page.data[spec.property].id, 7);
      assert.equal(f.page.data.loadFailed, false);
      assert.equal(f.page.data.loading, false);
    });
  }

  test(`${spec.name} detail: an unloaded page ignores late responses and new loads`, async () => {
    const f = detailFixture(spec);
    const pending = f.load();
    assert.equal(typeof f.page.onUnload, 'function');
    f.page.onUnload();
    let writes = 0;
    f.page.setData = () => { writes += 1; };
    f.pending[0].resolve(f.response());
    await pending;
    await f.load();
    assert.equal(writes, 0);
    assert.equal(f.pending.length, 1);
  });
}

function workerDetailFixture() {
  const pending = [];
  const env = createEnv({ user: { role: 'worker' }, deps: { '../../../utils/request': { get: (url) => {
    const gate = deferred(); pending.push({ ...gate, url }); return gate.promise;
  } } } });
  const page = env.page('miniapp/pages/worker/orders/detail.js');
  page.data.id = 7;
  return { page, pending };
}

test('worker detail: older response cannot undo a newer state or trigger stale child reads', async () => {
  const f = workerDetailFixture();
  const older = f.page.loadOrder();
  const latest = f.page.loadOrder();
  f.pending[1].resolve({ data: { id: 7, status: 'in_progress' } });
  await latest;
  f.pending[0].resolve({ data: { id: 7, status: 'confirmed', confirmed_at: '2026-10-01' } });
  await older;
  assert.equal(f.page.data.order.status, 'in_progress');
  assert.equal(f.page.data.order.canStart, false);
  assert.equal(f.page.data.order.canComplete, true);
  assert.equal(f.pending.filter(item => item.url.endsWith('/change-requests')).length, 1);
  f.pending[2].resolve({ data: [] });
  await tick();
});

test('worker detail: older failure cannot clear the newer loading indicator', async () => {
  const f = workerDetailFixture();
  const older = f.page.loadOrder();
  const latest = f.page.loadOrder();
  f.pending[0].reject(new Error('old offline failure'));
  await older;
  assert.equal(f.page.data.loading, true);
  f.pending[1].resolve({ data: { id: 7, status: 'in_progress' } });
  await latest;
  assert.equal(f.page.data.loading, false);
  f.pending[2].resolve({ data: [] });
  await tick();
});

test('worker detail: change request responses cannot undo a newer pending-request state', async () => {
  const f = workerDetailFixture();
  const older = f.page.loadChangeRequests();
  const latest = f.page.loadChangeRequests();
  f.pending[1].resolve({ data: [{ id: 1, request_type: 'scope', status: 'pending' }] });
  await latest;
  f.pending[0].resolve({ data: [] });
  await older;
  assert.equal(f.page.data.hasPendingRequest, true);
  assert.equal(f.page.data.changeRequests.length, 1);
});

test('worker detail: a newer order load invalidates child reads from the previous snapshot', async () => {
  const f = workerDetailFixture();
  const child = f.page.loadChangeRequests();
  const latest = f.page.loadOrder();
  f.pending[0].resolve({ data: [{ id: 1, request_type: 'scope', status: 'pending' }] });
  await child;
  assert.equal(f.page.data.hasPendingRequest, false);
  f.pending[1].resolve({ data: { id: 7, status: 'in_progress' } });
  await latest;
  f.pending[2].resolve({ data: [] });
  await tick();
});

test('worker detail: unloading ignores main and child responses and prevents new reads', async () => {
  const f = workerDetailFixture();
  const main = f.page.loadOrder();
  const child = f.page.loadChangeRequests();
  assert.equal(typeof f.page.onUnload, 'function');
  f.page.onUnload();
  let writes = 0;
  f.page.setData = () => { writes += 1; };
  f.pending[0].resolve({ data: { id: 7, status: 'in_progress' } });
  f.pending[1].resolve({ data: [{ id: 1, request_type: 'scope', status: 'pending' }] });
  await main; await child;
  await f.page.loadOrder(); await f.page.loadChangeRequests();
  assert.equal(writes, 0);
  assert.equal(f.pending.length, 2);
});

test('order card labels the time row by what it really is', () => {
  const env = createEnv();
  const card = env.component('miniapp/components/rh-order-card/rh-order-card.js');
  const view = (order) => {
    const ctx = { data: { order }, setData(patch) { Object.assign(this.data, patch); } };
    card.observers.order.call(ctx, order);
    return plain(ctx.data.view);
  };

  const visit = view({ status: 'confirmed', estimated_time: '2026-10-02T02:00:00.000Z', remark: '预约时间：2026-10-01 上午 08-12' });
  assert.equal(visit.timeLabel, '预计上门');

  const slot = view({ status: 'pending', created_at: '2026-09-30T02:00:00.000Z', remark: '预约时间：2026-10-01 上午 08-12\n漏水' });
  assert.equal(slot.timeLabel, '预约时间');
  assert.equal(slot.time, '2026-10-01 上午 08-12');

  const created = view({ status: 'pending', created_at: '2026-09-30T02:00:00.000Z', remark: '' });
  assert.equal(created.timeLabel, '下单时间');
  assert.match(created.time, /^2026-09-30 \d\d:\d\d$/);
  assert.match(read('miniapp/components/rh-order-card/rh-order-card.wxml'), /\{\{view\.timeLabel\}\}：\{\{view\.time\}\}/);
});

// ---------------------------------------------------------------- 师傅端
test('worker list: switching tabs while a request is running still loads the new tab', async () => {
  const pending = {};
  const api = { get: (url, params) => { pending[params.status] = deferred(); return pending[params.status].promise; } };
  const env = createEnv({ user: { role: 'worker' }, deps: { '../../../utils/request': api } });
  const page = env.page('miniapp/pages/worker/orders/list.js');

  const first = page.loadOrders(true);
  page.onTabChange({ detail: { key: 'completed' } });
  assert.ok(pending.completed, 'the new tab request is really sent');

  pending.confirmed.resolve({ data: { orders: [{ id: 1, status: 'confirmed' }], pagination: { total: 1 } } });
  pending.completed.resolve({ data: { orders: [{ id: 2, status: 'completed' }], pagination: { total: 1 } } });
  await first; await tick(); await tick();
  assert.deepEqual(plain(page.data.orders).map((item) => item.id), [2], 'stale result of the old tab is discarded');
  assert.equal(page.data.loading, false);
});

test('worker list: a failed load-more does not skip a page and failure shows a retry state', async () => {
  const requested = [];
  let fail = true;
  const api = { get: async (url, params) => {
    requested.push(params.page);
    if (fail) throw new Error('network');
    return { data: { orders: [{ id: 100 + params.page }], pagination: { total: 15 } } };
  } };
  const env = createEnv({ user: { role: 'worker' }, deps: { '../../../utils/request': api } });
  const page = env.page('miniapp/pages/worker/orders/list.js');

  await page.loadOrders(true);
  assert.equal(page.data.loadFailed, true);
  assert.match(read('miniapp/pages/worker/orders/list.wxml'), /loadFailed[^>]*action-text="重新加载"/);

  fail = false;
  await page.loadOrders(true);
  assert.equal(page.data.hasMore, true);
  fail = true;
  page.onReachBottom(); await tick(); await tick();
  assert.equal(page.data.page, 1);
  fail = false;
  page.onReachBottom(); await tick(); await tick();
  assert.deepEqual(requested, [1, 1, 2, 2]);
  assert.equal(page.data.page, 2);
});

test('worker list shows distinct status tags and hides call on finished orders', () => {
  const { getStatusText, getStatusClass, canCallCustomer } = require('../utils/workerStatus');
  assert.equal(getStatusText('confirmed'), '待接单');
  assert.equal(getStatusText('in_progress'), '施工中');
  assert.equal(getStatusText('pending_review'), '待验收');
  assert.equal(getStatusText('price_negotiating'), '价格协商');
  assert.equal(getStatusText('completed'), '已完成');
  assert.equal(getStatusClass('confirmed'), 'confirmed');
  assert.equal(getStatusClass('in_progress'), 'doing');
  assert.equal(getStatusClass('pending_review'), 'review');
  assert.equal(getStatusClass('price_negotiating'), 'pending');
  assert.equal(getStatusClass('completed'), 'done');
  assert.equal(canCallCustomer({ status: 'confirmed' }), true);
  assert.equal(canCallCustomer({ status: 'pending_review' }), true);
  assert.equal(canCallCustomer({ status: 'completed' }), false);
  assert.equal(canCallCustomer({ status: 'cancelled' }), false);

  const listWxml = read('miniapp/pages/worker/orders/list.wxml');
  assert.match(listWxml, /status="\{\{item\.statusClass\}\}"/);
  assert.match(listWxml, /text="\{\{item\.statusText\}\}"/);
  assert.match(listWxml, /wx:if="\{\{item\.canCall\}\}"/);
  const detailWxml = read('miniapp/pages/worker/orders/detail.wxml');
  assert.match(detailWxml, /status="\{\{order\.statusClass\}\}"/);
  assert.match(detailWxml, /text="\{\{order\.statusText\}\}"/);
  assert.match(detailWxml, /wx:if="\{\{order\.canCall\}\}"/);
  assert.match(read('miniapp/components/rh-status-tag/rh-status-tag.wxss'), /\.rh-status--review/);
});

test('worker must confirm the fees before a completion is submitted', async () => {
  const puts = [];
  const api = { get: async () => ({ data: { id: 8, status: 'in_progress' } }), put: async (url, body) => { puts.push([url, body]); return {}; } };
  const env = createEnv({ user: { role: 'worker' }, deps: { '../../../utils/request': api }, confirm: false });
  const page = env.page('miniapp/pages/worker/orders/detail.js');
  page.data.id = 8;
  Object.assign(page.data, { doorFee: '50', materialFee: '120.5', laborFee: '200' });

  await page.handleComplete();
  assert.equal(puts.length, 0, 'cancelling the confirmation submits nothing');
  assert.match(env.calls.modal[0].content, /合计 ¥370\.50/);

  env.confirm = true;
  await page.handleComplete();
  assert.deepEqual(plain(puts), [['/api/worker/orders/8/complete', { door_fee: 50, material_fee: 120.5, labor_fee: 200 }]]);
});

test('worker detail offers a retry when the order cannot be loaded', () => {
  assert.match(read('miniapp/pages/worker/orders/detail.wxml'), /rh-empty wx:else[^>]*action-text="重新加载"[^>]*bind:action="onRetryLoad"/);
});

// ---------------------------------------------------------------- 消息、地址
test('notifications show formatted times, update read state locally and can mark all as read', async () => {
  const puts = [];
  const request = {
    get: async () => ({ data: [
      { id: 1, order_id: 11, order_no: 'WO1', service_name: '堵漏', title: 'a', content: 'x', is_read: 0, created_at: '2026-09-30T03:02:11.000Z' },
      { id: 2, order_id: 12, order_no: 'WO2', title: 'b', content: 'y', is_read: 0, created_at: '2026-09-29T03:02:11.000Z' },
      { id: 3, title: 'c', content: 'z', is_read: 1, created_at: '2026-09-28T03:02:11.000Z' }
    ] }),
    put: async (url) => { puts.push(url); return { success: true }; }
  };
  const env = createEnv({ deps: { '../../utils/request': request } });
  const page = env.page('miniapp/pages/notifications/list.js');
  await page.load();
  assert.equal(page.data.unreadCount, 2);
  assert.match(page.data.items[0].timeText, /^2026-09-\d\d \d\d:\d\d$/);
  assert.equal(page.data.items[0].order_no, 'WO1');
  assert.doesNotMatch(read('miniapp/pages/notifications/list.wxml'), /item\.created_at/);
  assert.match(read('miniapp/pages/notifications/list.wxml'), /item\.order_no/);
  assert.match(read('miniapp/pages/notifications/list.wxml'), /bindtap="openMessage"/);

  await page.openMessage({ currentTarget: { dataset: { id: 1, orderId: 11 } } });
  assert.equal(page.data.items[0].is_read, 1);
  assert.equal(page.data.unreadCount, 1);
  assert.deepEqual(env.calls.navigateTo, ['/pages/orders/detail?id=11']);
  await page.openMessage({ currentTarget: { dataset: { id: 3 } } });
  assert.deepEqual(puts, ['/api/notifications/1/read'], 'already-read messages do not hit the server');
  assert.equal(env.calls.navigateTo.length, 1, 'messages without an order stay on the list');

  await page.markAllRead();
  assert.deepEqual(puts, ['/api/notifications/1/read', '/api/notifications/2/read']);
});

test('worker notifications open the worker order detail', async () => {
  const request = {
    get: async () => ({ data: [{ id: 8, order_id: 22, order_no: 'WO22', title: '指派', content: '新工单', is_read: 1, created_at: '2026-09-30T03:02:11.000Z' }] }),
    put: async () => ({ success: true })
  };
  const env = createEnv({ user: { role: 'worker' }, deps: { '../../utils/request': request } });
  const page = env.page('miniapp/pages/notifications/list.js');
  await page.load();
  await page.openMessage({ currentTarget: { dataset: { id: 8, orderId: 22 } } });
  assert.deepEqual(env.calls.navigateTo, ['/pages/worker/orders/detail?id=22']);
});

test('address list loads once on entry, refreshes silently and offers retry', async () => {
  let calls = 0;
  let fail = false;
  const api = { getAddresses: async () => { calls += 1; if (fail) throw new Error('network'); return { success: true, data: [{ id: 1 }] }; } };
  const env = createEnv({ deps: { '../../utils/api': api } });
  const page = env.page('miniapp/pages/address/list.js');
  page.onLoad({});
  page.onShow();
  await tick(); await tick();
  assert.equal(calls, 1, 'onLoad + onShow no longer send two requests');
  assert.equal(page.data.loading, false);

  page.onShow();
  assert.equal(page.data.loading, false, 'a refresh with data on screen does not flash the loading state');
  await tick(); await tick();

  fail = true;
  await page.loadAddresses();
  assert.equal(page.data.addresses.length, 1, 'failed refresh keeps the list');
  assert.equal(page.data.loadFailed, false);
  assert.equal(JSON.parse(read('miniapp/pages/address/list.json')).enablePullDownRefresh, true);
});

test('address list sends guests to login', () => {
  const env = createEnv({ token: null });
  const page = env.page('miniapp/pages/address/list.js');
  page.onLoad({ mode: 'select' });
  assert.deepEqual(env.calls.redirectTo, [`/pages/login/login?redirect=${encodeURIComponent('/pages/address/list?mode=select')}`]);
});

// ---------------------------------------------------------------- 组件
test('rh-empty emits an action event only when it shows a button', () => {
  const env = createEnv();
  const empty = env.component('miniapp/components/rh-empty/rh-empty.js');
  const events = [];
  empty.methods.onAction.call({ triggerEvent: (name) => events.push(name) });
  assert.deepEqual(events, ['action']);
  assert.match(read('miniapp/components/rh-empty/rh-empty.wxml'), /wx:if="\{\{actionText\}\}"/);
  assert.equal(JSON.parse(read('miniapp/components/rh-empty/rh-empty.json')).usingComponents['rh-button'], '/components/rh-button/rh-button');
});

test('small buttons and photo delete buttons have an enlarged tap area', () => {
  const button = read('miniapp/components/rh-button/rh-button.wxss');
  assert.match(button, /\.rh-btn--sm::after\s*\{[^}]*top:\s*-8rpx/);
  const booking = read('miniapp/pages/booking/create.wxss');
  assert.match(booking, /\.image-delete::after/);
  assert.match(booking, /\.image-delete\s*\{[^}]*width:\s*44rpx/);
});

test('rh-image stays visible while loading so WeChat does not false-error remote photos', () => {
  assert.doesNotMatch(read('miniapp/components/rh-image/rh-image.wxss'), /opacity:\s*0/);
  assert.match(read('miniapp/components/rh-image/rh-image.js'), /lazy:\s*\{\s*type:\s*Boolean,\s*value:\s*false\s*\}/);
  assert.match(read('backend/src/app.js'), /crossOriginResourcePolicy:\s*\{\s*policy:\s*'cross-origin'\s*\}/);
});
