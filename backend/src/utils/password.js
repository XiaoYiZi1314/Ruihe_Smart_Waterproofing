const crypto = require('crypto');

const WORKER_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALPHANUM = LETTERS + DIGITS;

function randomChar(alphabet) {
  return alphabet[crypto.randomInt(alphabet.length)];
}

function generateWorkerPassword(length = WORKER_PASSWORD_LENGTH) {
  const chars = [randomChar(LETTERS), randomChar(DIGITS)];
  while (chars.length < length) chars.push(randomChar(ALPHANUM));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function isValidWorkerPassword(password, { requireLetterAndDigit = false } = {}) {
  if (typeof password !== 'string' || password.length < WORKER_PASSWORD_LENGTH || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return false;
  }
  if (requireLetterAndDigit && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) return false;
  return true;
}

module.exports = { WORKER_PASSWORD_LENGTH, MAX_PASSWORD_BYTES, generateWorkerPassword, isValidWorkerPassword };
