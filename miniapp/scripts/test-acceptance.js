const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function load(file, globals = {}, deps = {}) {
  const module = { exports: {} }; let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    module, exports: module.exports, require: name => deps[name] || {},
    Page: value => { page = value; }, console, ...globals
  }, { filename: file });
  if (page) { page.data = JSON.parse(JSON.stringify(page.data)); page.setData = values => Object.assign(page.data, values); }
  return page || module.exports;
}
test('unassigned order urge persists an admin notification and broadcasts it', async () => {
  const events=[],logs=[];
  const db={query:async sql=> sql.includes('FROM work_orders') ? [[{id:7,order_no:'RH2026091300001',worker_id:null}]] : [[{id:1}]]};
  const service=load('backend/src/utils/notification.js', {process:{env:{}}}, {'../config/database':db,'./realtime':{notifyAdmins:(event,payload)=>events.push({event,payload})}});
  service.logNotification=async(...args)=>logs.push(args);
  await service.notifyWorkerOrderUrged(7,3);
  assert.equal(events.length,1);assert.equal(events[0].event,'order_urged');assert.match(events[0].payload.content,/第3次/);
  assert.equal(logs.length,1);assert.equal(logs[0][0],1);assert.equal(logs[0][2],'admin_order_urged');
});
test('service detail preserves MySQL native JSON image arrays', async () => {
  const Model=load('backend/src/models/Service.js',{}, {'../config/database':{query:async()=>[[{id:1,images:['/uploads/detail.jpg']}]]}});
  const service=await Model.getById(1);assert.deepEqual(Array.from(service.images),['/uploads/detail.jpg']);
});

test('customer confirms logout: clear session and return to login', () => {
  const storage = new Map([['token', 'old'], ['userInfo', {role:'customer'}]]);
  const app = { globalData: {userInfo: {role:'customer'}} }; let destination;
  const wx = { removeStorageSync: key => storage.delete(key), reLaunch: opts => {destination=opts.url;}, showModal: opts => opts.success({confirm:true}) };
  const session = load('miniapp/utils/session.js', {wx,getApp:()=>app});
  const auth = load('miniapp/utils/auth.js', {wx,getApp:()=>app}, {'./session':session});
  const page = load('miniapp/pages/profile/index.js', {wx}, {'../../utils/auth':auth});
  page.onLogout();
  assert.equal(storage.size, 0); assert.equal(app.globalData.userInfo,null); assert.equal(destination,'/pages/login/login');
});
test('order list urge sends request and refreshes recorded count', async () => {
  let calls=0,refreshes=0;
  const page = load('miniapp/pages/orders/list.js', {wx:{showToast(){}}}, {'../../utils/api':{urgeOrder:async id=>{assert.equal(id,7);calls++;return {success:true};}}});
  page.loadOrders=async ()=>{refreshes++;};
  await page.onOrderAction({detail:{action:'urge',order:{id:7}}});
  assert.equal(calls,1); assert.equal(refreshes,1);
});
test('dashboard adds MySQL string aggregates numerically', () => {
  const source=fs.readFileSync(path.join(root,'admin/src/views/Dashboard.vue'),'utf8');
  const expression=source.match(/const pendingCount = computed\(\(\) => \{([\s\S]*?)\n\}\);/)[1];
  const count=vm.runInNewContext('(function(){'+expression+'})()', {stats:{value:{orders:{pending:'1',confirmed:'0',in_progress:'0',pending_review:'0',price_negotiating:'0'}}}});
  assert.equal(count,1);
});
test('admin wrong password displays API error without expired-session redirect', async () => {
  let handler,message,redirect=false;
  const source=fs.readFileSync(path.join(root,'admin/src/api/index.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default api;','');
  vm.runInNewContext(source,{axios:{create:()=>({interceptors:{request:{use(){}},response:{use(ok,fail){handler=fail;}}}})}, ElMessage:{error:text=>{message=text;}},router:{push(){redirect=true;}},localStorage:{removeItem(){},getItem(){}}});
  await assert.rejects(handler({config:{url:'/auth/admin/login'},response:{status:401,data:{message:'账号或密码错误'}}}));
  assert.equal(message,'账号或密码错误'); assert.equal(redirect,false);
});
test('customer order list includes assigned worker phone from the database', async () => {
  const db={query:async sql=>{if(sql.includes('COUNT(*)'))return [[{total:1}]];assert.match(sql,/w\.phone\s+as\s+worker_phone/i);assert.match(sql,/JOIN users w ON wo.worker_id = w.id/);return [[{id:7,worker_phone:'13800138000'}]];}};
  const model=load('backend/src/models/WorkOrder.js',{}, {'../config/database':db});
  const result=await model.getByUserId(1); assert.equal(result.data[0].worker_phone,'13800138000');
});
test('returning to services reloads categories and services without clearing visible data', async () => {
  const page=load('miniapp/pages/services/list.js',{getApp:()=>({globalData:{}})});let categories=0,services=0;
  page.loadCategories=async()=>{categories++;};page.loadServices=async refresh=>{assert.equal(refresh,true);services++;};
  await page.onShow();assert.equal(categories,1);assert.equal(services,1);
});

test('cancelling customer logout keeps the existing session', () => {
  let cleared = false;
  let navigated = false;
  const wx = {
    showModal: options => options.success({ confirm: false }),
    reLaunch: () => { navigated = true; }
  };
  const page = load('miniapp/pages/profile/index.js', { wx }, {
    '../../utils/auth': { clearAuth: () => { cleared = true; } }
  });
  page.onLogout();
  assert.equal(cleared, false);
  assert.equal(navigated, false);
});

test('switching to worker login clears the customer session only after confirmation', () => {
  const calls = [];
  let confirmed = false;
  const wx = {
    showModal: options => options.success({ confirm: confirmed }),
    reLaunch: options => calls.push(options.url)
  };
  const page = load('miniapp/pages/profile/index.js', { wx }, {
    '../../utils/auth': { clearAuth: () => calls.push('clear') }
  });
  page.onSwitchRole();
  assert.deepEqual(calls, []);
  confirmed = true;
  page.onSwitchRole();
  assert.deepEqual(calls, ['clear', '/pages/login/login?mode=worker']);
});

test('profile actions wrap virtual-host buttons so flex-basis cannot collapse their height', () => {
  const markup = fs.readFileSync(path.join(root, 'miniapp/pages/profile/index.wxml'), 'utf8');
  const actions = [...markup.matchAll(
    /<view class="profile-action">\s*<rh-button\b([^>]+)\/>\s*<\/view>/g
  )].map(match => match[1]);
  // 游客两个入口 + 已登录三个入口
  assert.equal(actions.length, 5);
  assert.match(actions[0], /bind:tap="onGuestLogin"/);
  assert.match(actions[1], /bind:tap="onWorkerLoginEntry"/);
  assert.match(actions[2], /text="退出登录"/);
  assert.match(actions[2], /variant="danger"/);
  assert.match(actions[2], /bind:tap="onLogout"/);
  assert.match(actions[3], /bind:tap="onSwitchRole"/);
  assert.match(actions[4], /bind:tap="onMessages"/);
});

test('all button sizes keep their height as virtual-host children of a column flex container', () => {
  const css = fs.readFileSync(path.join(root, 'miniapp/components/rh-button/rh-button.wxss'), 'utf8');
  for (const [size, height] of [['sm', 64], ['md', 72], ['lg', 88]]) {
    const rule = css.match(new RegExp(`\\.rh-btn--${size}\\s*\\{([^}]+)\\}`));
    assert(rule, `Missing button size: ${size}`);
    assert.match(rule[1], new RegExp(`min-height:\\s*${height}rpx`));
  }
});

test('worker login button accepts valid form data and routes after saving the session', async () => {
  for (const mustChangePassword of [false, true]) {
    const events = [];
    const worker = { role: 'worker', must_change_password: mustChangePassword };
    const wx = {
      showToast() {},
      reLaunch: options => events.push(options.url)
    };
    const page = load('miniapp/pages/login/login.js', {
      wx, getApp: () => ({ sessionReady: Promise.resolve(true) }),
      setTimeout: callback => callback()
    }, {
      '../../utils/request': { post: async (url, body) => {
        assert.equal(url, '/api/auth/worker-login');
        assert.equal(body.phone, 'W-test');
        assert.equal(body.password, 'test-only-not-a-real-password');
        return { success: true, data: { token: 'test-token', user: worker } };
      } },
      '../../utils/session': {
        save: () => events.push('saved'), capture: () => ({}), isCurrent: () => true
      }
    });
    page.data.workerPhone = 'W-test';
    page.data.workerPassword = 'test-only-not-a-real-password';
    await page.onWorkerLogin();
    assert.deepEqual(events, ['saved', mustChangePassword
      ? '/pages/worker/profile/index' : '/pages/worker/orders/list']);
    assert.equal(page.data.workerLoading, false);
  }
});
