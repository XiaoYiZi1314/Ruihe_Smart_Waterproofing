const DEFAULT_SECURITY_QUESTION = '我和他第一次遇见的时间';
const MAX_TEXT = 40;

function tooLong(text) {
  return Array.from(text).length > MAX_TEXT;
}

function normalizeQuestion(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || DEFAULT_SECURITY_QUESTION;
}

function normalizeAnswer(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function assertSecurityQuestion(value) {
  const text = normalizeQuestion(value);
  if (tooLong(text)) fail('密保问题不超过40个字');
  return text;
}

function assertSecurityAnswer(value) {
  const text = normalizeAnswer(value);
  if (!text) fail('请填写密保答案');
  if (tooLong(text)) fail('密保答案不超过40个字');
  return text;
}

module.exports = {
  DEFAULT_SECURITY_QUESTION,
  normalizeQuestion,
  normalizeAnswer,
  assertSecurityQuestion,
  assertSecurityAnswer
};
