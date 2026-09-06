const assert = require('assert');
const { buildWorkerLoginLookup } = require('../src/utils/workerLoginLookup');

const phone = buildWorkerLoginLookup('13800138000');
assert.deepStrictEqual(phone.params, ['13800138000', '13800138000']);
assert.ok(!phone.sql.includes('id = ?'));

const employeeNo = buildWorkerLoginLookup('12');
assert.deepStrictEqual(employeeNo.params, ['12', '12', 12]);
assert.ok(employeeNo.sql.includes('id = ?'));

const username = buildWorkerLoginLookup('W-001');
assert.deepStrictEqual(username.params, ['W-001', 'W-001']);
assert.ok(!username.sql.includes('id = ?'));

console.log('worker-login lookup tests passed');
