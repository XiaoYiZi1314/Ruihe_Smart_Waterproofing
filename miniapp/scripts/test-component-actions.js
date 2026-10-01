const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function replay(pageFile, component, handler, dataset = {}) {
  const calls = { handler: 0, navigate: [], phone: [], clipboard: [], subscribe: 0, login: 0 };
  const wx = {
    navigateTo: options => calls.navigate.push(options.url),
    makePhoneCall: options => calls.phone.push(options.phoneNumber),
    setClipboardData: options => { calls.clipboard.push(options.data); options.success(); },
    showToast() {},
    login: options => { calls.login += 1; options.success({ code: 'test-code' }); }
  };
  const deps = {
    '../../utils/auth': { requireLogin: () => true },
    '../../../utils/request': { post: async () => ({ success: true }) },
    '../../../utils/notifications': { subscribe: async () => { calls.subscribe += 1; return true; } }
  };
  let page, definition;
  vm.runInNewContext(read(pageFile + '.js'), {
    Page: value => { page = value; }, wx, console,
    require: name => deps[name] || {}
  });
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = patch => Object.assign(page.data, patch);
  if (page.buildMenu) page.buildMenu();
  if (page.data.contact !== undefined) page.data.contact = { phone: 'test-phone', wechat: 'test-wechat' };
  if (page.data.joinInfo !== undefined) page.data.joinInfo = { phone: 'test-join-phone' };
  const original = page[handler];
  assert.equal(typeof original, 'function', `${pageFile}: ${handler}`);
  page[handler] = function (event) { calls.handler += 1; return original.call(page, event); };

  const base = `miniapp/components/${component}/${component}`;
  vm.runInNewContext(read(base + '.js'), { Component: value => { definition = value; } });
  const host = [...read(pageFile + '.wxml').matchAll(new RegExp(`<${component}\\b[^>]*>`, 'g'))]
    .map(match => match[0]).find(tag => tag.includes(`="${handler}"`));
  assert.ok(host, `${pageFile}: missing ${handler} binding`);
  const bindings = new Map([...host.matchAll(/(?:bind|catch):?(\w+)="(\w+)"/g)].map(match => [match[1], match[2]]));
  const rootNode = read(base + '.wxml').match(/<view\b[^>]*>/)[0];
  const nativeBinding = rootNode.match(/(bind|catch):?tap="(\w+)"/);
  const event = detail => ({ currentTarget: { dataset }, detail });
  // Replay the custom notification followed by the original native event if it can bubble.
  definition.methods[nativeBinding[2]].call({ triggerEvent(type, detail) {
    if (bindings.has(type)) page[bindings.get(type)](event(detail || {}));
  } });
  if (nativeBinding[1] === 'bind' && bindings.has('tap')) page[bindings.get('tap')](event({ x: 100, y: 200 }));
  return { calls, rootNode, bindings, page };
}

for (const id of ['address', 'about']) {
  test(`customer menu ${id}: a native click navigates once`, () => {
    const result = replay('miniapp/pages/profile/index', 'rh-menu-item', 'onMenuTap', { id });
    assert.equal(result.calls.handler, 1);
    assert.equal(result.calls.navigate.length, 1);
    assert.match(result.rootNode, /catch:tap="onTap"/);
    assert.equal(result.bindings.get('select'), 'onMenuTap');
    assert.equal(result.bindings.has('tap'), false);
  });
}

for (const handler of ['openPasswordModal', 'bindWechat', 'subscribe', 'goMessages']) {
  test(`worker menu ${handler}: a native click activates once`, async () => {
    const result = replay('miniapp/pages/worker/profile/index', 'rh-menu-item', handler);
    await tick();
    assert.equal(result.calls.handler, 1);
    assert.equal(result.bindings.get('select'), handler);
    if (handler === 'goMessages') assert.equal(result.calls.navigate.length, 1);
    if (handler === 'bindWechat') assert.equal(result.calls.login, 1);
    if (handler === 'subscribe') assert.equal(result.calls.subscribe, 1);
    if (handler === 'openPasswordModal') assert.equal(result.page.data.showPasswordModal, true);
  });
}

for (const [file, handler] of [
  ['miniapp/pages/index/index', 'onCallPhone'],
  ['miniapp/pages/index/index', 'onCopyWechat'],
  ['miniapp/pages/index/index', 'onJoinConsult'],
  ['miniapp/pages/about/index', 'onCallPhone']
]) {
  test(`${file} contact ${handler}: one native click causes one action`, () => {
    const result = replay(file, 'rh-contact-line', handler);
    assert.equal(result.calls.handler, 1);
    assert.equal(result.calls.phone.length + result.calls.clipboard.length, 1);
    assert.match(result.rootNode, /catch:tap="onTap"/);
    assert.equal(result.bindings.get('select'), handler);
    assert.equal(result.bindings.has('tap'), false);
  });
}
