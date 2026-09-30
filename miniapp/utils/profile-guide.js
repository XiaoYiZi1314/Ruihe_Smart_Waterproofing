// 首次登录引导完善资料：仅客户、且昵称仍是默认的“微信用户”，每个账号只引导一次
const DEFAULT_NICKNAME = '微信用户';

function storageKey(user) {
  return 'profileGuided_' + user.id;
}

// 需要引导时返回 true，并立即记录“已引导”，之后不再打扰（用户可在编辑页直接跳过）
function consume(user) {
  if (!user || user.role !== 'customer') return false;
  if (user.nickname && user.nickname !== DEFAULT_NICKNAME) return false;
  if (wx.getStorageSync(storageKey(user))) return false;
  wx.setStorageSync(storageKey(user), 1);
  return true;
}

module.exports = { consume };
