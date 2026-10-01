const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const invalidIds = [undefined, null, '', 'undefined', 'null', 'NaN', 0, '0', -1, '-1', '1x', '1.5', '1e2', '1/2', ' 1', '01', true, [], {}, '9007199254740992'];

function harness() {
  const cache = new Map();
  const definitions = new Map();
  const calls = { urls: [], requests: [], stack: [], toast: [], back: 0 };
  const store = new Map([['token', 'test-token']]);
  const app = { globalData: { apiBaseUrl: 'https://fixture.test' } };
  const timers = [];
  const wx = {
    getStorageSync: key => store.get(key),
    setStorageSync: (key, value) => store.set(key, value),
    removeStorageSync: key => store.delete(key),
    showToast: options => calls.toast.push(options.title),
    stopPullDownRefresh() {},
    navigateBack: () => { calls.back += 1; calls.stack.pop(); },
    navigateTo({ url }) {
      calls.urls.push(url);
      const parsed = new URL(url, app.globalData.apiBaseUrl);
      if (!/^\/pages\/(services|orders)\/detail$/.test(parsed.pathname)) return;
      const page = makePage('miniapp' + parsed.pathname + '.js');
      calls.stack.push(page);
      page.onLoad(Object.fromEntries(parsed.searchParams));
    },
    request(options) {
      const parsed = new URL(options.url);
      calls.requests.push(parsed.pathname);
      const id = parsed.pathname.split('/').pop();
      let data;
      if (parsed.pathname.startsWith('/api/services/') && id === '1') {
        data = { id: 1, name: '平屋面防水', price_min: 80, price_max: 150, images: [], reviews: [] };
      } else if (parsed.pathname.startsWith('/api/orders/') && id === '7') {
        data = { id: 7, status: 'pending', images: [] };
      }
      Promise.resolve().then(() => options.success({
        statusCode: data ? 200 : 404,
        data: data ? { success: true, data } : { success: false, message: '服务不存在' }
      }));
    }
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const absolute = path.join(root, file);
    const module = { exports: {} };
    cache.set(file, module);
    vm.runInNewContext(read(file), {
      module, exports: module.exports, wx, getApp: () => app,
      console: { error() {}, log() {} },
      setTimeout: callback => timers.push(callback), clearTimeout() {},
      Page: value => definitions.set(file, value),
      Component: value => definitions.set(file, value),
      require: name => {
        const relative = path.relative(root, path.resolve(path.dirname(absolute), name + '.js'));
        return load(relative.split(path.sep).join('/'));
      }
    }, { filename: file });
    return module.exports;
  }
  function makePage(file) {
    load(file);
    const page = Object.create(definitions.get(file));
    page.data = JSON.parse(JSON.stringify(page.data));
    page.setData = patch => Object.assign(page.data, patch);
    return page;
  }
  // Model only this component's custom event and original native tap, not the WeChat runtime.
  function clickCard(pageFile, component, property, item) {
    const page = makePage(pageFile + '.js');
    if (property === 'order') page.data.orders = [item];
    const base = `miniapp/components/${component}/${component}`;
    load(base + '.js');
    const host = read(pageFile + '.wxml').match(new RegExp(`<${component}\\b[^>]*>`))[0];
    const bindings = new Map([...host.matchAll(/(?:bind|catch):?(\w+)="(\w+)"/g)].map(match => [match[1], match[2]]));
    const rootNode = read(base + '.wxml').match(/<view\b[^>]*>/)[0];
    const nativeBinding = rootNode.match(/(bind|catch):?tap="(\w+)"/);
    const ctx = {
      data: { [property]: item },
      triggerEvent(type, detail) {
        if (bindings.has(type)) page[bindings.get(type)]({ type, detail });
      }
    };
    definitions.get(base + '.js').methods[nativeBinding[2]].call(ctx);
    if (nativeBinding[1] === 'bind' && bindings.has('tap')) {
      page[bindings.get('tap')]({ type: 'tap', detail: { x: 100, y: 200 } });
    }
    return { page, rootNode, bindings, definition: definitions.get(base + '.js') };
  }
  return { calls, makePage, clickCard, load, timers };
}

for (const file of ['miniapp/pages/services/list', 'miniapp/pages/index/index']) {
  test(`${file}: one service card click opens exactly one working detail`, async () => {
    const h = harness();
    const result = h.clickCard(file, 'rh-service-card', 'service', { id: 1, name: '平屋面防水' });
    await tick(); await tick();
    assert.deepEqual(h.calls.urls, ['/pages/services/detail?id=1']);
    assert.deepEqual(h.calls.requests, ['/api/services/1']);
    assert.equal(h.calls.stack.length, 1);
    assert.equal(h.calls.stack[0].data.service.name, '平屋面防水');
    assert.equal(h.calls.stack[0].data.loadFailed, false);
    assert.match(result.rootNode, /catch:tap="onTap"/);
    assert.equal(result.bindings.get('select'), 'onServiceTap');
    assert.equal(result.bindings.has('tap'), false);
  });
}

test('one order card click opens exactly one working detail', async () => {
  const h = harness();
  const result = h.clickCard('miniapp/pages/orders/list', 'rh-order-card', 'order', { id: 7 });
  await tick(); await tick();
  assert.deepEqual(h.calls.urls, ['/pages/orders/detail?id=7']);
  assert.deepEqual(h.calls.requests, ['/api/orders/7']);
  assert.equal(h.calls.stack.length, 1);
  assert.equal(h.calls.stack[0].data.order.id, 7);
  assert.match(result.rootNode, /catch:tap="onTap"/);
  assert.equal(result.bindings.get('select'), 'onOrderTap');
  assert.equal(result.bindings.has('tap'), false);
});

test('service booking and order actions remain separate from card selection', () => {
  const h = harness();
  const service = h.clickCard('miniapp/pages/services/list', 'rh-service-card', 'service', { id: 1 });
  const events = [];
  service.definition.methods.onBook.call({ data: { service: { id: 1 } }, triggerEvent: (type, detail) => events.push({ type, detail }) });
  const order = h.clickCard('miniapp/pages/orders/list', 'rh-order-card', 'order', { id: 7 });
  order.definition.methods.onAction.call({ data: { order: { id: 7 } }, triggerEvent: (type, detail) => events.push({ type, detail }) }, { currentTarget: { dataset: { action: 'urge' } } });
  assert.deepEqual(events.map(event => event.type), ['book', 'action']);
  assert.equal(events[0].detail.service.id, 1);
  assert.equal(events[1].detail.action, 'urge');
  assert.match(read('miniapp/components/rh-service-card/rh-service-card.wxml'), /catch:tap="onBook"/);
  assert.match(read('miniapp/components/rh-order-card/rh-order-card.wxml'), /catch:tap="onAction"/);
});

test('service and order entry handlers reject invalid IDs and raw native taps', () => {
  for (const file of ['miniapp/pages/services/list.js', 'miniapp/pages/index/index.js', 'miniapp/pages/orders/list.js']) {
    const h = harness();
    const page = h.makePage(file);
    const property = file.includes('/orders/') ? 'order' : 'service';
    const handler = property === 'order' ? 'onOrderTap' : 'onServiceTap';
    page[handler]({ detail: { x: 100, y: 200 } });
    page[handler]({});
    for (const id of invalidIds) {
      if (property === 'order') page.data.orders = [{ id }];
      page[handler]({ detail: { [property]: { id } } });
    }
    assert.deepEqual(h.calls.urls, [], file);
  }
});

test('detail pages never request invalid IDs, including retry and pull-down', async () => {
  for (const kind of ['services', 'orders']) {
    for (const id of invalidIds) {
      const h = harness();
      const page = h.makePage(`miniapp/pages/${kind}/detail.js`);
      page.onLoad({ id });
      page.onRetryLoad();
      await page.onPullDownRefresh();
      const loadDetail = kind === 'services' ? 'loadServiceDetail' : 'loadOrderDetail';
      await page[loadDetail](id);
      await tick();
      assert.deepEqual(h.calls.requests, [], `${kind}: ${String(id)}`);
      assert.equal(page.data.loading, false);
      assert.equal(page.data.loadErrorText, '参数错误');
    }
  }
});

test('booking entry keeps valid numeric and string IDs, and rejects malformed IDs', () => {
  for (const file of ['miniapp/pages/services/list.js', 'miniapp/pages/index/index.js']) {
    for (const id of [1, '1']) {
      const h = harness();
      const page = h.makePage(file);
      for (const invalid of invalidIds) page.onBookTap({ detail: { service: { id: invalid } } });
      assert.deepEqual(h.calls.urls, []);
      page.onBookTap({ detail: { service: { id } } });
      assert.deepEqual(h.calls.urls, ['/pages/booking/create?serviceId=1']);
    }
  }
});

test('order progress and review actions only navigate with valid IDs', async () => {
  for (const action of ['progress', 'review']) {
    const h = harness();
    const page = h.makePage('miniapp/pages/orders/list.js');
    for (const id of invalidIds) await page.onOrderAction({ detail: { action, order: { id } } });
    assert.deepEqual(h.calls.urls, []);
    await page.onOrderAction({ detail: { action, order: { id: '7' } } });
    await tick();
    assert.deepEqual(h.calls.urls, ['/pages/orders/detail?id=7']);
    assert.equal(h.calls.stack[0].data.order.id, 7);
  }
});

test('service banner links reject invalid IDs before navigating', () => {
  const h = harness();
  const page = h.makePage('miniapp/pages/index/index.js');
  for (const id of invalidIds) page.onBannerTap({ currentTarget: { dataset: { banner: { link_type: 'service', link_value: id } } } });
  assert.deepEqual(h.calls.urls, []);
});
