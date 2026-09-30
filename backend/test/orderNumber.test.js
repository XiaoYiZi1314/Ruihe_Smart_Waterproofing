const assert = require('node:assert/strict');
const test = require('node:test');
const {nextOrderNo, orderDate} = require('../src/utils/orderNumber');
test('order date uses China day boundary independently of server timezone',()=>{
  assert.equal(orderDate(new Date('2026-08-08T16:00:00Z')),'20260809');
  assert.equal(orderDate(new Date('2026-08-08T15:59:59Z')),'20260808');
});
test('daily sequence is four digits and refuses overflow',async()=>{
  let value=0;const db={query:async(sql,args)=>{
    if(sql.startsWith('SELECT')){assert.match(sql,/FOR UPDATE/);return [[{last_value:value}]];}
    if(sql.startsWith('UPDATE'))value=args[0];return [{}];
  }};
  assert.equal(await nextOrderNo(db,new Date('2026-08-09T00:00:00Z')),'RH202608090001');
  assert.equal(await nextOrderNo(db,new Date('2026-08-09T00:00:00Z')),'RH202608090002');
  value=9999;await assert.rejects(nextOrderNo(db), /上限/);
});
