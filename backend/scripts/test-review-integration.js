require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { generateToken } = require('../src/utils/jwt');
if (!/^waterproof_test_/.test(process.env.DB_NAME || '') || process.env.ALLOW_ISOLATED_TEST !== 'yes') throw Error('Refusing to test outside explicitly isolated database');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Test server must be loopback');
let passed = 0;
async function request(method, url, data, token, expected = 200) {
  const res = await fetch(base + url, { method, headers: { 'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {}) }, body: data == null ? undefined : JSON.stringify(data) });
  const body = await res.json(); assert.equal(res.status, expected, method + ' ' + url + ': ' + body.message); return body;
}
function ok(name) { passed++; console.log('PASS ' + name); }
async function main() {
  const db = await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  try {
    const suffix=crypto.randomUUID().slice(0,8);
    const [a]=await db.query("INSERT INTO users(openid,nickname,role) VALUES(?,?,'admin')",['test-admin-'+suffix,'Test admin']);
    const [c]=await db.query("INSERT INTO users(openid,nickname,role) VALUES(?,?,'customer')",['test-customer-'+suffix,'Test customer']);
    const [other]=await db.query("INSERT INTO users(openid,nickname,role) VALUES(?,?,'customer')",['test-other-'+suffix,'Other']);
    const token=(id,role)=>generateToken({id,role,tokenVersion:0});
    const admin=token(a.insertId,'admin'),customer=token(c.insertId,'customer'),otherToken=token(other.insertId,'customer');
    await request('GET','/api/admin/orders',null,customer,403); await request('GET','/api/worker/orders',null,customer,403); ok('role boundaries');
    const worker=(await request('POST','/api/admin/workers',{phone:'139'+String(Date.now()).slice(-8),nickname:'Test worker'},admin)).data;
    const login=await request('POST','/api/auth/worker-login',{phone:worker.phone,password:worker.initial_password});
    await request('GET','/api/worker/orders',null,login.data.token,403); ok('temporary password gate');
    const newPassword=crypto.randomBytes(18).toString('base64url')+'A1';
    const changed=await request('POST','/api/auth/change-password',{current_password:worker.initial_password,new_password:newPassword},login.data.token);
    const workerToken=changed.data.token;
    await request('GET','/api/auth/me',null,login.data.token,401); ok('password change invalidates old token');
    const cat=(await request('POST','/api/admin/categories',{name:'Review '+suffix},admin)).data.id;
    const service=(await request('POST','/api/admin/services',{category_id:cat,name:'UniqueRoof'+suffix,price_min:100},admin)).data.id;
    const search=await request('GET','/api/services?keyword='+encodeURIComponent('UniqueRoof'+suffix));assert.equal(search.data.length,1);ok('service keyword filtering');
    await request('PUT','/api/admin/config',{contact_phone:'13900000001',contact_address:'Test address',contact_hours:'09:00-18:00',join_info:{join_phone:'13900000002',brand_intro:'Join test'}},admin);
    const config=(await request('GET','/api/config')).data;assert.equal(config.contact_info.phone,'13900000001');assert.equal(config.join_info.phone,'13900000002');ok('public configuration roundtrip');
    const address=(await request('POST','/api/addresses',{contact_name:'Old contact',contact_phone:'13900000003',detail_address:'Test address'},customer)).data.id;
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
    const form=new FormData(); form.append('file',new Blob([image],{type:'image/png'}),'photo.png');
    const uploaded=await fetch(base+'/api/upload/image',{method:'POST',headers:{Authorization:'Bearer '+customer},body:form});assert.equal(uploaded.status,200);const imageUrl=(await uploaded.json()).data.url;
    assert.equal((await fetch(base+imageUrl)).status,403);ok('private attachment denies anonymous access');
    await request('POST','/api/orders',{service_id:service,address_id:address,images:[imageUrl]},otherToken,403);ok('cross-user address rejected');
    const makeOrder=async()=> (await request('POST','/api/orders',{service_id:service,address_id:address,contact_name:'Updated contact',contact_phone:'13900000004',expected_price:200,remark:'Requested morning',images:[imageUrl]},customer)).data.id;
    const id=await makeOrder();
    const parallelOrders=await Promise.all(Array.from({length:12},()=>makeOrder()));
    const [numberRows]=await db.query('SELECT order_no FROM work_orders WHERE id IN (?)',[[id,...parallelOrders]]);
    assert.equal(new Set(numberRows.map(row=>row.order_no)).size,13);
    assert(numberRows.every(row=>/^RH\d{13}$/.test(row.order_no)));
    const sequences=numberRows.map(row=>Number(row.order_no.slice(-5))).sort((a,b)=>a-b);
    assert.equal(sequences[12]-sequences[0],12);ok('concurrent bookings use unique consecutive five-digit order numbers');
    await request('PUT',`/api/orders/${id}/urge`,{},customer);
    const notices=(await request('GET','/api/notifications',null,admin)).data;
    assert(notices.some(item=>Number(item.order_id)===id && /第1次/.test(item.content)));
    const urged=(await request('GET',`/api/admin/orders/${id}`,null,admin)).data;
    assert.equal(urged.urge_count,1);ok('unassigned customer urge persists in admin notifications and order detail');
    const detail=(await request('GET',`/api/orders/${id}`,null,customer)).data;assert.equal(detail.contact_name,'Updated contact');assert.equal(detail.contact_phone,'13900000004');assert.equal('reject_reason' in detail,false);ok('booking contact and safe customer projection');
    const signed=new URL(detail.images[0].image_url);assert.equal((await fetch(base+signed.pathname+signed.search)).status,200);ok('authorized detail returns usable signed image');
    await request('GET',`/api/orders/${id}`,null,otherToken,403);ok('cross-user order rejected');
    const assign=async id=>request('PUT',`/api/admin/orders/${id}/assign`,{worker_id:worker.id,estimated_time:'2030-01-01 10:00:00'},admin);
    await assign(id);
    const listed=(await request('GET','/api/orders?limit=50',null,customer)).data.find(item=>item.id===id);
    assert.equal(listed.worker_phone,worker.phone);ok('customer order list exposes assigned worker contact');
    await request('PUT',`/api/worker/orders/${id}/accept`,{},workerToken);
    await db.query('UPDATE work_orders SET assigned_at=DATE_SUB(NOW(),INTERVAL 25 HOUR) WHERE id=?',[id]);
    const Scheduler=require('../src/jobs/scheduler');await Scheduler.detectExceptions();
    let [rows]=await db.query('SELECT is_exception FROM work_orders WHERE id=?',[id]);assert.equal(rows[0].is_exception,1);ok('accept without start still becomes exceptional');
    await request('PUT',`/api/worker/orders/${id}/start`,{},workerToken);
    [rows]=await db.query('SELECT is_exception FROM work_orders WHERE id=?',[id]);assert.equal(rows[0].is_exception,0);ok('start clears exception');
    await request('PUT',`/api/worker/orders/${id}/complete`,{door_fee:10,material_fee:100,labor_fee:50},workerToken);
    await request('PUT',`/api/orders/${id}/dispute-price`,{reason:'Price too high'},customer);
    await db.query('UPDATE work_orders SET completed_at=DATE_SUB(NOW(),INTERVAL 10 DAY), dispute_started_at=DATE_SUB(NOW(),INTERVAL 8 DAY),auto_complete_at=DATE_SUB(NOW(),INTERVAL 7 DAY) WHERE id=?',[id]);
    await request('PUT',`/api/admin/orders/${id}/adjust-price`,{door_fee:10,material_fee:80,labor_fee:50},admin);
    [rows]=await db.query('SELECT TIMESTAMPDIFF(HOUR,NOW(),auto_complete_at) AS remaining FROM work_orders WHERE id=?',[id]);assert(rows[0].remaining>=23);ok('negotiation preserves remaining acceptance time');
    await request('PUT',`/api/orders/${id}/dispute-price`,{reason:'Second round'},customer,409);ok('second negotiation rejected');
    await Scheduler.completeDueOrders();[rows]=await db.query('SELECT status FROM work_orders WHERE id=?',[id]);assert.equal(rows[0].status,'pending_review');ok('scheduler respects restored deadline');
    await request('PUT',`/api/orders/${id}/confirm`,{},customer);
    const videoForm=new FormData();videoForm.append('file',new Blob([Buffer.from('00000018667479706d703432000000006d70343269736f6d','hex')],{type:'video/mp4'}),'review.mp4');
    const videoResponse=await fetch(base+'/api/upload/video',{method:'POST',headers:{Authorization:'Bearer '+customer},body:videoForm});assert.equal(videoResponse.status,200);const videoUrl=(await videoResponse.json()).data.url;ok('MP4 attachment upload contract');
    await request('POST',`/api/orders/${id}/review`,{service_attitude_score:5,quality_score:4,price_score:5,comment:'Good',video_url:videoUrl},customer);
    assert((await request('GET',`/api/services/${service}`)).data.reviews.length>0);ok('completed order public review');
    await request('DELETE',`/api/orders/${id}/review`,null,customer);
    await request('POST',`/api/orders/${id}/review`,{service_attitude_score:5,quality_score:4,price_score:5},customer,409);ok('review delete without edit-through-resubmit');
    const cancelId=await makeOrder();await assign(cancelId);
    await request('PUT',`/api/orders/${cancelId}/cancel`,{},customer);
    await request('PUT',`/api/worker/orders/${cancelId}/start`,{},workerToken,409);ok('confirmed cancellation cannot be resurrected');
    const rejectId=await makeOrder();await assign(rejectId);await request('PUT',`/api/worker/orders/${rejectId}/reject`,{reason:'Private reason'},workerToken);
    const contest=await makeOrder();await assign(contest);
    const responses=await Promise.all([
      fetch(base+`/api/orders/${contest}/cancel`,{method:'PUT',headers:{Authorization:'Bearer '+customer,'Content-Type':'application/json'},body:'{}'}),
      fetch(base+`/api/worker/orders/${contest}/start`,{method:'PUT',headers:{Authorization:'Bearer '+workerToken,'Content-Type':'application/json'},body:'{}'})
    ]);
    assert.equal(responses[0].status,200);assert([200,409].includes(responses[1].status));
    [rows]=await db.query('SELECT status FROM work_orders WHERE id=?',[contest]);assert.equal(rows[0].status,'cancelled');ok('concurrent cancel and start preserve terminal cancellation');
    const rejected=(await request('GET',`/api/orders/${rejectId}`,null,customer)).data;assert.equal('reject_reason' in rejected,false);
    assert.equal((await request('GET',`/api/admin/orders/${rejectId}`,null,admin)).data.reject_reason,'Private reason');ok('rejection reason admin-only');
    await request('PUT',`/api/admin/orders/${rejectId}/cancel`,{reason:'Test cleanup'},admin);
    const reset=(await request('POST',`/api/admin/workers/${worker.id}/reset-password`,{},admin)).data;
    assert(reset.initial_password);await request('GET','/api/worker/stats',null,workerToken,401);ok('administrator password reset invalidates existing session');
    await request('DELETE',`/api/admin/workers/${worker.id}`,null,admin);
    const inactiveId=await makeOrder();await request('PUT',`/api/admin/orders/${inactiveId}/assign`,{worker_id:worker.id,estimated_time:'2030-01-01 10:00:00'},admin,400);
    assert(!(await request('GET','/api/admin/workers',null,admin)).data.workers.some(w=>w.id===worker.id));ok('inactive worker hidden and rejected');
    await request('POST','/api/admin/workers',{phone:worker.phone,nickname:'Replacement worker'},admin);ok('deleted worker phone can be reused');
    const trend=(await request('GET','/api/admin/dashboard/trend?days=2',null,admin)).data.trend;assert(trend.some(d=>d.new_orders>0));ok('trend dates and counts');
    const exportResponse=await fetch(base+'/api/admin/orders/export?keyword=does-not-exist-'+suffix,{headers:{Authorization:'Bearer '+admin}});
    assert.equal(exportResponse.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));assert.equal(book.worksheets[0].rowCount,1);ok('filtered Excel export');
    await db.query('UPDATE work_orders SET created_at=DATE_SUB(NOW(),INTERVAL 40 DAY) WHERE id=?',[id]);
    const dashboard=(await request('GET','/api/admin/dashboard',null,admin)).data;
    assert(Object.values(dashboard.orders).every(value=>typeof value==='number'));
    assert(dashboard.orders.pending<=dashboard.orders.total);ok('dashboard aggregate counts are numeric');
    assert(dashboard.today.completed_orders>=1);assert(dashboard.month.total_revenue>=140);ok('finished-at based dashboard');
    // The notification service uses the same isolated DB and templates are unset in staging.
    const [logs]=await db.query("SELECT order_id FROM operation_logs WHERE action='create_order' AND user_id=?",[c.insertId]);assert(logs.every(l=>l.order_id));ok('create logs preserve order IDs');
    console.log(`${passed} integration checks passed`);
  } finally { await db.end(); const pool=require('../src/config/database'); await pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
