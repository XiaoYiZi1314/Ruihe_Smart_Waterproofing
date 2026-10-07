'use strict';

const MAX_COUNT = 8;
const MAX_LENGTH = 12;
const DEFAULT_HIGHLIGHTS = ['质保5年', '免费勘测', '签约施工'];

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function splitPlain(text) {
  return text.split(/[,，、\n]+/);
}

function toList(input) {
  if (input == null || input === '') return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // 兼容逗号/顿号分隔的纯文本
    }
    return splitPlain(trimmed);
  }
  fail('服务亮点格式无效');
}

function parseHighlights(input) {
  const seen = new Set();
  const result = [];
  for (const raw of toList(input)) {
    if (raw == null) continue;
    const text = String(raw).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if ([...text].length > MAX_LENGTH) fail(`单个服务亮点不超过${MAX_LENGTH}个字`);
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  if (result.length > MAX_COUNT) fail(`服务亮点最多${MAX_COUNT}个`);
  return result;
}

function readHighlights(input) {
  try {
    if (input == null || input === '') return [];
    if (Array.isArray(input)) return parseHighlights(input);
    if (typeof input === 'string') {
      const parsed = JSON.parse(input.trim());
      if (!Array.isArray(parsed)) return [];
      return parseHighlights(parsed);
    }
    return [];
  } catch (_) {
    return [];
  }
}

module.exports = {
  MAX_COUNT,
  MAX_LENGTH,
  DEFAULT_HIGHLIGHTS,
  parseHighlights,
  readHighlights
};
