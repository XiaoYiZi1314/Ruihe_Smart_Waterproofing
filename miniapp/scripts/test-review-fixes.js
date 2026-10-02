const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function harness(initialToken = 'old-token') {
  const storage = new Map(initialToken ? [['token', initialToken], ['userInfo', { role: 'customer' }]] : []);
  const requests = [], routes = [], cache = new Map();
  let app = { globalData: {} }, page;
  const wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), request: options => requests.push(options),
    uploadFile: options => requests.push(options), getAccountInfoSync: () => ({miniProgram:{envVersion:'release'}}),
    reLaunch: options => routes.push(options.url), showLoading() {}, hideLoading() {}, showToast() {}
  };
  function load(file, deps = {}) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = {exports:{}}; cache.set(absolute,module);
    vm.runInNewContext(fs.readFileSync(absolute,'utf8'), {
      module, exports:module.exports, console, process: {env:{}}, Promise, setTimeout, clearTimeout, wx,
      getApp:()=>app, getCurrentPages:()=>[], App:value=>{app=value;}, Page:value=>{page=value;},
      require:name => Object.prototype.hasOwnProperty.call(deps,name) ? deps[name] : name.startsWith('.') ? load(path.relative(root,path.resolve(path.dirname(absolute),name+'.js'))) : require(name)
    }, {filename:file});
    return module.exports;
  }
  return {storage,requests,routes,wx,load,get app(){return app;},get page(){return page;}};
}
function start(h) {h.load('miniapp/app.js');h.app.onLaunch();return h.app.sessionReady;}
test('startup provides an awaitable session validation', async()=>{
  const h=harness();const ready=start(h);assert.equal(typeof ready?.then,'function');
  h.requests[0].success({statusCode:200,data:{success:true,data:{role:'worker'}}});await ready;
  assert.equal(h.storage.get('userInfo').role,'worker');
});
test('late startup 401 cannot remove a newer login', async()=>{
  const h=harness();const ready=start(h);
  h.storage.set('token','new-token');h.storage.set('userInfo',{role:'worker'});
  h.requests[0].success({statusCode:401,data:{success:false}});await ready;
  assert.equal(h.storage.get('token'),'new-token');assert.equal(h.storage.get('userInfo').role,'worker');
});
test('late startup success cannot replace newer user information',async()=>{
  const h=harness();const ready=start(h);h.storage.set('token','new-token');h.app.globalData.userInfo={role:'worker'};
  h.requests[0].success({statusCode:200,data:{success:true,data:{role:'customer'}}});await ready;
  assert.equal(h.app.globalData.userInfo.role,'worker');
});
test('transient startup network failure preserves credentials',async()=>{
  const h=harness();const ready=start(h);h.requests[0].fail({errMsg:'timeout'});await ready;
  assert.equal(h.storage.get('token'),'old-token');
});
test('current startup 401 invalidates credentials',async()=>{
  const h=harness();const ready=start(h);h.requests[0].success({statusCode:401,data:{success:false}});await ready;
  assert.equal(h.storage.has('token'),false);
});
test('late authenticated API 401 cannot clear new credentials or redirect',async()=>{
  const h=harness();const request=h.load('miniapp/utils/request.js');const pending=request.get('/api/orders');
  h.storage.set('token','new-token');h.requests[0].success({statusCode:401,data:{message:'expired'}});
  await assert.rejects(pending);assert.equal(h.storage.get('token'),'new-token');assert.equal(h.routes.length,0);
});
test('home keeps latest response when refreshes finish out of order',async()=>{
  const h=harness();const deferred=[];
  const api={getBanners:async()=>({success:true,data:[]}),getCategories:async()=>({success:true,data:[]}),getConfig:async()=>({success:true,data:{}}),getServices:()=>new Promise(resolve=>deferred.push(resolve))};
  h.load('miniapp/pages/index/index.js',{'../../utils/api':api});const page=h.page;page.setData=values=>Object.assign(page.data,values);
  const old=page.loadData(),fresh=page.loadData();
  deferred[1]({success:true,data:[{id:2,name:'fresh'}]});await fresh;
  deferred[0]({success:true,data:[{id:1,name:'stale'}]});await old;
  assert.equal(page.data.services[0].name,'fresh');
});
test('public config returns one canonical value for both business-hour keys',async()=>{
  const h=harness(null);
  const Config=h.load('backend/src/models/SiteConfig.js',{'../config/database':{query:async()=>[[
    {config_key:'contact_info',config_type:'json',config_value:JSON.stringify({business_hours:'8:00-20:00'})},
    {config_key:'contact_hours',config_type:'text',config_value:'8:00-18:00'}
  ]]}});
  const result=await Config.getPublicConfigs();
  assert.equal(result.contact_info.hours,'8:00-18:00');assert.equal(result.contact_info.business_hours,'8:00-18:00');
});
test('logout and relogin with the same token invalidates the old revision',()=>{
  const h=harness();const session=h.load('miniapp/utils/session.js');const old=session.capture();
  session.clear();session.save('old-token',{role:'worker'});
  assert.equal(session.isCurrent(old),false);assert.equal(session.clear(old),false);
  assert.equal(h.storage.get('token'),'old-token');
});
test('current API 401 clears storage and global state and returns to login',async()=>{
  const h=harness();h.app.globalData.userInfo={role:'customer'};
  const request=h.load('miniapp/utils/request.js');const pending=request.get('/api/orders');
  h.requests[0].success({statusCode:401,data:{message:'expired'}});await assert.rejects(pending);
  assert.equal(h.storage.has('token'),false);assert.equal(h.app.globalData.userInfo,null);
  assert.deepEqual(h.routes,['/pages/login/login']);
});
test('stale successful API response is rejected rather than exposing previous account data',async()=>{
  const h=harness();const request=h.load('miniapp/utils/request.js');const pending=request.get('/api/orders');
  h.storage.set('token','new-token');h.requests[0].success({statusCode:200,data:{success:true,data:[{id:1}]}});
  await assert.rejects(pending,/会话已切换/);
});
test('late upload 401 neither clears new session nor redirects', async () => {
  const h = harness();
  const request = h.load('miniapp/utils/request.js');
  const pending = request.upload('/temporary/photo.jpg');
  h.storage.set('token', 'new-token');
  h.requests[0].success({ statusCode: 401, data: JSON.stringify({ message: 'expired' }) });
  await assert.rejects(pending);
  assert.equal(h.storage.get('token'), 'new-token');
  assert.equal(h.routes.length, 0);
});

test('upload failure explains the real device cause instead of always saying network failed', async () => {
  const cases = [
    [{ errMsg: 'uploadFile:fail url not in domain list' }, '上传域名未配置，请在微信公众平台配置 uploadFile 合法域名'],
    [{ errMsg: 'uploadFile:fail timeout' }, '上传超时，请检查网络后重试'],
    [{ errMsg: 'uploadFile:fail file error, file not found' }, '头像文件已失效，请重新选择头像'],
    [{ errMsg: 'uploadFile:fail abort' }, '上传已取消，请重试']
  ];
  for (const [failure, expected] of cases) {
    const h = harness();
    const request = h.load('miniapp/utils/request.js');
    const pending = request.upload('/temporary/photo.jpg', 'avatar');
    assert.equal(h.requests.length, 1);
    h.requests[0].fail(failure);
    await assert.rejects(pending, error => error.message === expected && error.type === 'network');
    assert.equal(h.routes.length, 0);
  }
});

test('upload response errors preserve HTTP status and backend message', async () => {
  const h = harness();
  const request = h.load('miniapp/utils/request.js');
  const pending = request.upload('/temporary/photo.jpg', 'avatar');
  h.requests[0].success({ statusCode: 413, data: JSON.stringify({ success: false, message: '头像文件过大' }) });
  await assert.rejects(pending, error => error.statusCode === 413 && error.message === '头像文件过大');
});

test('malformed upload responses use a response-specific error', async () => {
  const h = harness();
  const request = h.load('miniapp/utils/request.js');
  const pending = request.upload('/temporary/photo.jpg', 'avatar');
  h.requests[0].success({ statusCode: 200, data: '<html>gateway error</html>' });
  await assert.rejects(pending, error => error.type === 'upload' && error.message === '上传响应异常，请稍后重试');
});

test('startup without credentials settles without requesting the backend',async()=>{
  const h=harness(null);assert.equal(await start(h),false);assert.equal(h.requests.length,0);
});
test('startup server errors do not delete credentials',async()=>{
  const h=harness();const ready=start(h);h.requests[0].success({statusCode:500,data:{success:false}});await ready;
  assert.equal(h.storage.get('token'),'old-token');
});
test('login page waits for validated user data before routing',async()=>{
  const h=harness();const ready=start(h);h.load('miniapp/pages/login/login.js');const page=h.page;
  page.setData=values=>Object.assign(page.data,values);page.onLoad();
  await Promise.resolve();assert.equal(h.routes.length,0);
  h.requests[0].success({statusCode:200,data:{success:true,data:{role:'worker',must_change_password:true}}});await ready;await Promise.resolve();
  assert.deepEqual(h.routes,['/pages/worker/profile/index']);
});
test('worker login begins only after pending startup validation settles',async()=>{
  const h=harness();const ready=start(h);h.load('miniapp/pages/login/login.js');const page=h.page;
  page.setData=values=>Object.assign(page.data,values);page.data.workerPhone='worker';page.data.workerPassword='example';
  const login=page.onWorkerLogin();assert.equal(h.requests.length,1);
  h.requests[0].success({statusCode:401,data:{success:false}});await ready;await new Promise(setImmediate);
  assert.equal(h.requests.length,2);
  h.requests[1].success({statusCode:401,data:{message:'账号或密码错误'}});await login;
  assert.equal(page.data.workerLoading,false);
});
function homeFixture() {
  const h=harness(),pending=[],toasts=[];let hidden=0;
  h.wx.showToast=o=>toasts.push(o.title);h.wx.hideLoading=()=>hidden++;
  const api={getBanners:async()=>({success:true,data:[]}),getCategories:async()=>({success:true,data:[{id:1,name:'one'},{id:2,name:'two'}]}),getConfig:async()=>({success:true,data:{}}),getServices:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
  h.load('miniapp/pages/index/index.js',{'../../utils/api':api});const page=h.page;
  page.setData=values=>Object.assign(page.data,values);
  return {h,page,pending,toasts,get hidden(){return hidden;}};
}
test('old home failure does not toast or hide a newer loading indicator',async()=>{
  const f=homeFixture();const old=f.page.loadData(),fresh=f.page.loadData();
  f.pending[0].reject(new Error('old failure'));await old;
  assert.equal(f.toasts.length,0);assert.equal(f.hidden,0);
  f.pending[1].resolve({success:true,data:[]});await fresh;assert.equal(f.hidden,1);
});
test('home refresh preserves category selection and visible data on latest failure',async()=>{
  const f=homeFixture();f.page.data.currentCategoryId=2;
  const refresh=f.page.loadData();f.pending[0].resolve({success:true,data:[{id:2,category_id:2}]});await refresh;
  assert.equal(f.page.data.currentCategoryId,2);
  assert.equal(f.page.data.services.length,1);assert.equal(f.page.data.services[0].id,2);
  const failed=f.page.loadData();f.pending[1].reject(new Error('network'));await failed;
  assert.equal(f.page.data.services[0].id,2);assert.equal(f.toasts.length,1);
});
test('home ignores responses after page unload',async()=>{
  const f=homeFixture();const pending=f.page.loadData();f.page.onUnload();
  f.pending[0].resolve({success:true,data:[{id:99}]});await pending;
  assert.equal(f.page.data.services.length,0);
});
test('development origin is explicit and normalized',()=>{
  const h=harness(null);const env=h.load('miniapp/utils/environment.js');
  const platform={getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),getStorageSync:()=> ' http://192.168.1.20:3000/ '};
  assert.equal(env.getApiBaseUrl(platform),'http://192.168.1.20:3000');
  assert.throws(()=>env.normalizeOrigin('https://user:password@example.test'),/不能包含/);
  assert.throws(()=>env.normalizeOrigin('https://example.test/api'),/不能包含/);
});
test('trial, release and unavailable environment info cannot use dev overrides',()=>{
  const h=harness(null);const env=h.load('miniapp/utils/environment.js');
  for(const version of ['trial','release']) {
    assert.equal(env.getApiBaseUrl({getAccountInfoSync:()=>({miniProgram:{envVersion:version}}),getStorageSync:()=>{throw Error('must not read');}}),env.PRODUCTION_ORIGIN);
  }
  assert.equal(env.getApiBaseUrl({getAccountInfoSync(){throw Error('unavailable');}}),env.PRODUCTION_ORIGIN);
});
test('legacy-only hours still populate both keys without inventing a value',async()=>{
  const h=harness(null);const Config=h.load('backend/src/models/SiteConfig.js',{'../config/database':{query:async()=>[[{config_key:'contact_info',config_type:'json',config_value:JSON.stringify({business_hours:'legacy hours'})}]]}});
  const result=await Config.getPublicConfigs();assert.equal(result.contact_info.hours,'legacy hours');assert.equal(result.contact_info.business_hours,'legacy hours');
});
test('subscription uses preloaded templates and reports actual consent',async()=>{
  const h=harness(null);const notifications=h.load('miniapp/utils/notifications.js');
  const loading=notifications.loadConfig();
  h.requests[0].success({statusCode:200,data:{success:true,data:{subscription_templates:{worker_assigned:'template-a',order_urged:'template-b'}}}});
  h.requests[0].complete();await loading;
  let ids;
  h.wx.requestSubscribeMessage=o=>{ids=Array.from(o.tmplIds);o.success({'template-a':'reject','template-b':'reject'});};
  assert.equal(await notifications.subscribe(['worker_assigned','order_urged']),false);
  assert.deepEqual(ids,['template-a','template-b']);
  h.wx.requestSubscribeMessage=o=>o.success({'template-a':'accept'});
  assert.equal(await notifications.subscribe(['worker_assigned']),true);
});
test('booking and worker profile preload configuration without waiting for a support-phone tap',async()=>{
  const customer=harness();let customerLoads=0;
  customer.load('miniapp/pages/booking/create.js',{'../../utils/notifications':{loadConfig:()=>customerLoads++}});
  const booking=customer.page;booking.setData=v=>Object.assign(booking.data,v);booking.loadService=()=>{};booking.loadDefaultAddress=()=>{};
  booking.onLoad({serviceId:1});assert.equal(customerLoads,1);
  const worker=harness();worker.storage.set('userInfo',{role:'worker'});let workerLoads=0;
  worker.load('miniapp/pages/worker/profile/index.js',{'../../../utils/notifications':{loadConfig:()=>workerLoads++},'../../../utils/request':{get:async()=>({data:{role:'worker',must_change_password:true}})}});
  const profile=worker.page;profile.setData=v=>Object.assign(profile.data,v);await profile.onShow();assert.equal(workerLoads,1);
});
test('unconfigured subscription remains a safe false result, not a fake success',async()=>{
  const h=harness(null);const notifications=h.load('miniapp/utils/notifications.js');let invoked=false;
  h.wx.requestSubscribeMessage=()=>{invoked=true;};
  assert.equal(await notifications.subscribe(['worker_assigned']),false);assert.equal(invoked,false);
});
