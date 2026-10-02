const assert = require('assert');
const { WORKER_PASSWORD_LENGTH, generateWorkerPassword, isValidWorkerPassword } = require('../src/utils/password');

assert.equal(WORKER_PASSWORD_LENGTH, 8);

const password = generateWorkerPassword();
assert.equal(password.length, 8);
assert.match(password, /[A-Za-z]/);
assert.match(password, /\d/);
assert.equal(isValidWorkerPassword(password, { requireLetterAndDigit: true }), true);

assert.equal(isValidWorkerPassword('Abcd1234', { requireLetterAndDigit: true }), true);
assert.equal(isValidWorkerPassword('Abcdefg1'.slice(0, 7), { requireLetterAndDigit: true }), false);
assert.equal(isValidWorkerPassword('abcdefgh', { requireLetterAndDigit: true }), false);
assert.equal(isValidWorkerPassword('12345678', { requireLetterAndDigit: true }), false);
assert.equal(isValidWorkerPassword('abcdefgh'), true);

const unique = new Set(Array.from({ length: 40 }, () => generateWorkerPassword()));
assert.ok(unique.size > 1);

console.log('worker password tests passed');
