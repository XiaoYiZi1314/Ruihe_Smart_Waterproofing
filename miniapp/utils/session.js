// Shared by startup validation, requests and login/logout. No request dependency.
let revision = 0;
function capture() {
  return { token: wx.getStorageSync('token'), revision };
}
function isCurrent(snapshot) {
  return snapshot.revision === revision && snapshot.token === wx.getStorageSync('token');
}
function updateUser(user) {
  wx.setStorageSync('userInfo', user);
  getApp().globalData.userInfo = user;
}
function save(token, user) {
  revision += 1;
  wx.setStorageSync('token', token);
  updateUser(user);
}
function clear(snapshot) {
  if (snapshot && !isCurrent(snapshot)) return false;
  revision += 1;
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  const app = getApp();
  app.globalData.userInfo = null;
  app.globalData.serviceKeyword = '';
  return true;
}
module.exports = { capture, isCurrent, updateUser, save, clear };
