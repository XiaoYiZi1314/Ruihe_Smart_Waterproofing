const SHANGHAI = 'Asia/Shanghai';

export function formatDate(value) {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const naive = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.exec(text);
  if (naive) return naive[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
