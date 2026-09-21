const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(get = async () => ({ data: { orders: [], pagination: { total: 0 } } })) {
  const source = fs.readFileSync(path.join(__dirname, '../src/views/Orders.vue'), 'utf8')
    .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
  const events = new Map();
  const timers = new Map();
  const calls = [];
  const hooks = {};
  const window = {
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name),
    setInterval: (callback, delay) => { assert.equal(delay, 15000); timers.set(1, callback); return 1; },
    clearInterval: id => timers.delete(id)
  };
  const document = { visibilityState: 'visible',
    addEventListener: window.addEventListener, removeEventListener: window.removeEventListener };
  const context = { ref: value => ({ value }), reactive: value => value,
    watch() {}, onMounted: callback => { hooks.mount = callback; },
    onBeforeUnmount: callback => { hooks.unmount = callback; },
    window, document, console, ElMessage: {}, ElMessageBox: {},
    api: { get: (url, options) => { calls.push({ url, options }); return get(url, options); } } };
  vm.runInNewContext(source + `\nthis.page = {
    orders, loading, pagination, filter, detailVisible, currentOrder,
    loadOrders, showDetail, refreshCurrentOrders, orderStatusText
  };`, context);
  return { page: context.page, hooks, events, timers, calls, document };
}
const list = status => ({ data: { orders: [{ id: 7, status }], pagination: { total: 1 } } });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('accepted and unaccepted confirmed orders have different row and detail labels', () => {
  const { page } = fixture();
  assert.equal(page.orderStatusText({ status: 'confirmed' }), '待接单');
  assert.equal(page.orderStatusText({ status: 'confirmed', confirmed_at: '2026-09-21' }), '已接单，待开工');
  assert.equal(page.orderStatusText({ status: 'in_progress' }), '施工中');
});

test('late list responses cannot undo newer status updates', async () => {
  const first = deferred(); const second = deferred(); let count = 0;
  const { page } = fixture(() => (++count === 1 ? first.promise : second.promise));
  const oldRequest = page.loadOrders(); const newRequest = page.loadOrders({ silent: true });
  second.resolve(list('in_progress')); await newRequest;
  first.resolve(list('confirmed')); await oldRequest;
  assert.equal(page.orders.value[0].status, 'in_progress');
  assert.equal(page.loading.value, false);
});

test('socket events refresh the list and open detail without resetting filter or pagination', async () => {
  const f = fixture(async url => url.endsWith('/7') ? { data: { id: 7, status: 'in_progress' } } : list('in_progress'));
  f.hooks.mount(); await settle();
  f.page.pagination.page = 3; f.page.filter.status = 'in_progress';
  await f.page.showDetail({ id: 7, status: 'confirmed' });
  f.calls.length = 0;
  f.events.get('ruihe:orders-changed')(); await settle();
  assert.deepEqual(f.calls.map(call => call.url), ['/admin/orders', '/admin/orders/7']);
  assert.equal(f.calls[0].options.params.page, 3);
  assert.equal(f.calls[0].options.params.status, 'in_progress');
  assert.equal(f.page.currentOrder.value.status, 'in_progress');
  f.hooks.unmount();
});

test('old detail responses cannot replace a newly selected order or reopen a closed drawer', async () => {
  const first = deferred(); const second = deferred();
  const { page } = fixture(url => url.endsWith('/7') ? first.promise : second.promise);
  const oldRequest = page.showDetail({ id: 7 }); const newRequest = page.showDetail({ id: 8 });
  second.resolve({ data: { id: 8, status: 'in_progress' } }); await newRequest;
  first.resolve({ data: { id: 7, status: 'confirmed' } }); await oldRequest;
  assert.equal(page.currentOrder.value.id, 8);
  const last = deferred(); const f = fixture(() => last.promise);
  const loading = f.page.showDetail({ id: 7 }); f.page.detailVisible.value = false;
  last.resolve({ data: { id: 7, status: 'in_progress' } }); await loading;
  assert.equal(f.page.detailVisible.value, false);
  assert.equal(f.page.currentOrder.value.status, undefined);
});

test('polling, focus and visibility recover missed events and clean up on unmount', async () => {
  const f = fixture(); f.hooks.mount(); await settle(); f.calls.length = 0;
  f.timers.get(1)(); await settle(); assert.equal(f.calls.length, 1);
  f.document.visibilityState = 'hidden'; f.timers.get(1)();
  assert.equal(f.calls.length, 1);
  f.document.visibilityState = 'visible';
  f.events.get('visibilitychange')(); f.events.get('focus')(); await settle();
  assert.equal(f.calls.length, 3);
  f.hooks.unmount(); assert.equal(f.timers.size, 0); assert.equal(f.events.size, 0);
  f.page.refreshCurrentOrders(); assert.equal(f.calls.length, 3);
});

test('unmounted pages ignore pending list responses', async () => {
  const request = deferred(); const f = fixture(() => request.promise);
  const pending = f.page.loadOrders(); f.hooks.unmount();
  request.resolve(list('in_progress')); await pending;
  assert.equal(f.page.orders.value.length, 0);
});
