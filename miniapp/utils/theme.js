const COVER_GRADIENTS = [
  'linear-gradient(135deg, #1A5CFF, #5B9AF5)',
  'linear-gradient(135deg, #2B7BE4, #5B9AF5)',
  'linear-gradient(135deg, #5B9AF5, #7DB5FF)',
  'linear-gradient(135deg, #1A5CFF, #2B7BE4)',
  'linear-gradient(135deg, #2B7BE4, #7DB5FF)'
];

function coverGradient(seed) {
  const value = String(seed == null ? 0 : seed);
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash + value.charCodeAt(i) * (i + 1)) % COVER_GRADIENTS.length;
  }
  return COVER_GRADIENTS[hash];
}

function formatPrice(min, max, unit) {
  if (min == null && max == null) {
    return { main: '面议', suffix: '' };
  }
  if (min != null && max != null && Number(min) !== Number(max)) {
    return {
      main: `¥${Number(min)}-${Number(max)}`,
      suffix: unit || ''
    };
  }
  const value = min != null ? min : max;
  return {
    main: `¥${Number(value)}`,
    suffix: unit || '起'
  };
}

function maskPhone(phone) {
  if (!phone) return '';
  const text = String(phone).replace(/\s/g, '');
  if (text.length < 7) return phone;
  return `${text.slice(0, 3)} **** ${text.slice(-4)}`;
}

function joinAddress(address) {
  if (!address) return '';
  if (address.full_address) return address.full_address;
  return [address.province, address.city, address.district, address.detail_address]
    .filter(Boolean)
    .join(' ');
}

function isDevEnv() {
  try {
    const info = wx.getAccountInfoSync();
    return info.miniProgram.envVersion !== 'release';
  } catch (error) {
    return true;
  }
}

function formatTime(value) {
  if (value == null || value === '') return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const naive = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.exec(text);
  if (naive) return naive[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

module.exports = {
  formatTime,
  COVER_GRADIENTS,
  coverGradient,
  formatPrice,
  maskPhone,
  joinAddress,
  isDevEnv
};