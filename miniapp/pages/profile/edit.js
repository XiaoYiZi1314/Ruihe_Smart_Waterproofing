const api = require('../../utils/api');
const request = require('../../utils/request');
const session = require('../../utils/session');

const DEFAULT_NICKNAME = '微信用户';

Page({
  data: {
    isWorker: false,
    guide: false,
    avatarUrl: '',
    avatarTemp: '',
    nickname: '',
    saving: false
  },

  onLoad(options = {}) {
    const user = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token')) return wx.reLaunch({ url: '/pages/login/login' });
    const isWorker = user.role === 'worker';
    this.setData({
      isWorker,
      guide: options.guide === '1',
      avatarUrl: user.avatar_url || '',
      // 默认昵称不回填，留空表示“保持不变”，也方便直接点键盘上的微信昵称
      nickname: isWorker ? (user.nickname || '') : (user.nickname === DEFAULT_NICKNAME ? '' : (user.nickname || ''))
    });
  },

  // 用户在头像按钮里选择后，得到的是本地临时文件；点“保存”时才上传，避免产生多余文件
  onChooseAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ avatarUrl, avatarTemp: avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  async onSave() {
    if (this.data.saving) return;
    const user = wx.getStorageSync('userInfo') || {};
    const payload = {};
    const nickname = (this.data.nickname || '').trim();
    if (!this.data.isWorker && nickname && nickname !== user.nickname) payload.nickname = nickname;
    if (!this.data.avatarTemp && !payload.nickname) {
      wx.showToast({ title: '没有需要保存的修改', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      if (this.data.avatarTemp) payload.avatar_url = await request.upload(this.data.avatarTemp, 'avatar');
      const res = await api.updateProfile(payload);
      session.updateUser({ ...user, ...res.data });
      this.setData({ avatarTemp: '', avatarUrl: res.data.avatar_url || '' });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => this.goBack(), 800);
    } catch (error) {
      // 上传/保存失败时 request 已弹出提示；保留已选内容，方便直接重试
    } finally {
      this.setData({ saving: false });
    }
  },

  onSkip() {
    this.goBack();
  },

  goBack() {
    const role = (wx.getStorageSync('userInfo') || {}).role;
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: role === 'worker' ? '/pages/worker/profile/index' : '/pages/profile/index' })
    });
  }
});
