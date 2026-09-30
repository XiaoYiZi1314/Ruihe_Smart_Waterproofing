const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const State = require('../src/utils/orderStateMachine');
const { orderFilter } = require('../src/utils/orderFilter');
function load(file, deps, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { module, exports: module.exports, console, process: {env:{}}, Buffer, ...globals,
    require(name) { if (!(name in deps)) throw Error('Unexpected dependency: ' + name); return deps[name]; } });
  return module.exports;
}
function fixture(order, worker = { id: 8, role: 'worker', status: 'active', worker_status: 'working' }) {
  const sql = []; const calls = [];
  const connection = { async beginTransaction() { calls.push('begin'); }, async commit() {calls.push('commit');}, async rollback(){calls.push('rollback');}, release(){calls.push('release');},
    async query(query, params) { sql.push({query,params}); if(query.startsWith('SELECT * FROM users'))return [[worker]];if(query.startsWith('SELECT * FROM work_orders'))return [[order]]; return [{affectedRows:1}]; } };
  const workflow = load('utils/orderWorkflow.js', { './orderChangeLog': require('../src/utils/orderChangeLog'), '../config/database': {async getConnection(){return connection;}}, './orderStateMachine':State, './realtime':{notifyOrderChange:async()=>{}} });
  return { workflow, sql, calls };
}
test('cancelled order cannot be started and transaction rolls back', async()=>{
  const f=fixture({id:42,worker_id:8,status:'cancelled'});
  await assert.rejects(f.workflow.transition(42,{id:8,role:'worker'},'start'),e=>e.status===409);
  assert.equal(f.sql.some(s=>s.query.startsWith('UPDATE')),false); assert(f.calls.includes('rollback'));assert(f.calls.includes('release'));
});
test('order ownership is checked after locked read', async()=>{
  const f=fixture({id:42,worker_id:9,status:'confirmed'});
  await assert.rejects(f.workflow.transition(42,{id:8,role:'worker'},'start'),e=>e.status===403);
  assert.match(f.sql[0].query,/FOR UPDATE/);
});
test('inactive worker cannot be assigned', async()=>{
  const f=fixture({id:42,status:'pending'},{id:8,status:'inactive',worker_status:'working'});
  await assert.rejects(f.workflow.transition(42,{id:1,role:'admin'},'assign',{worker_id:8,estimated_time:'2030-01-01 10:00:00'}),e=>e.status===400);
  assert.equal(f.sql.some(s=>s.query.startsWith('UPDATE')),false);
});
test('confirmed customer cancellation is allowed', async()=>{
 const f=fixture({id:42,user_id:7,status:'confirmed'});await f.workflow.transition(42,{id:7,role:'customer'},'cancel');assert(f.calls.includes('commit'));
});
test('second price negotiation is rejected', async()=>{
 const f=fixture({id:42,user_id:7,status:'pending_review',price_adjusted_at:'2026-01-01'});
 await assert.rejects(f.workflow.transition(42,{id:7,role:'customer'},'dispute',{reason:'again'}),e=>e.status===409);
});
test('accept does not clear exception',async()=>{
 const f=fixture({id:42,worker_id:8,status:'confirmed',confirmed_at:null});await f.workflow.transition(42,{id:8,role:'worker'},'accept');
 const update=f.sql.find(s=>s.query.startsWith('UPDATE work_orders'));assert.doesNotMatch(update.query,/is_exception/);
});
test('adjustment preserves remaining acceptance interval',async()=>{
 const f=fixture({id:42,status:'price_negotiating'});await f.workflow.transition(42,{id:1,role:'admin'},'adjust_price',{door_fee:1,material_fee:2,labor_fee:3});
 const update=f.sql.find(s=>s.query.startsWith('UPDATE work_orders'));assert.match(update.query,/dispute_started_at/);assert.match(update.query,/auto_complete_at = DATE_ADD\(NOW\(\)/);
});
test('fee input rejects null, NaN and negative values',()=>{
 const f=fixture({});for(const value of [null,{},'',NaN,Infinity,-1])assert.throws(()=>f.workflow.fees({door_fee:value,material_fee:0,labor_fee:0}));
 assert.equal(f.workflow.fees({door_fee:0.1,material_fee:0.2,labor_fee:0}).final_price,0.3);
});
test('same filter includes keyword, worker and dates for list and export',()=>{
 const f=orderFilter({keyword:'customer',worker_id:8,start_date:'2026-01-01',end_date:'2026-02-01'});assert.match(f.whereClause,/contact_name LIKE/);assert.match(f.whereClause,/worker_id/);assert.equal(f.params.length,6);
});
test('site configuration maps old and new schema',async()=>{
 const Config=load('models/SiteConfig.js',{'../config/database':{async query(){return [[{config_key:'contact_phone',config_value:'13900000000',config_type:'text'},{config_key:'join_info',config_type:'json',config_value:JSON.stringify({join_phone:'13800000000',brand_intro:'test'})}]];}}});
 const c=await Config.getPublicConfigs();assert.equal(c.contact_info.phone,'13900000000');assert.equal(c.join_info.phone,'13800000000');assert.equal(c.join_info.description,'test');
});
test('customer SQL uses explicit safe fields',async()=>{
 const queries=[];const Model=load('models/WorkOrder.js',{'../utils/orderChangeLog':require('../src/utils/orderChangeLog'),'../utils/orderNumber':{},'../utils/orderWorkflow':{},'../utils/attachments':{presentOrder:o=>o,loadReviewImages:async()=>({})},'../config/database':{async query(q){queries.push(q);return [[{id:42}]];}}});
 await Model.getById(42);assert.doesNotMatch(queries[0],/wo\.\*|reject_reason/);assert.match(queries[0],/wo\.contact_name/);
});
test('service search passes keyword to the model',async()=>{
 let input;const controller=load('controllers/serviceController.js',{'../config/database':{},'../models/Service':{async getList(q){input=q;return {data:[]};}}});
 await controller.getServices({query:{keyword:'roof'}},{json(){},status(){return this;}});assert.equal(input.keyword,'roof');
});
