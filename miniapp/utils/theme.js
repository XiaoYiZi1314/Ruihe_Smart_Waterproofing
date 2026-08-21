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
      main: `¥${min}-${max}`,
      suffix: unit || ''
    };
  }
  const value = min != null ? min : max;
  return {
    main: `¥${value}`,
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

module.exports = {
  COVER_GRADIENTS,
  coverGradient,
  formatPrice,
  maskPhone,
  joinAddress,
  isDevEnv
};