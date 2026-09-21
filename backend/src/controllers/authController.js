const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { buildWorkerLoginLookup } = require('../utils/workerLoginLookup');
const { exchangeCode } = require('../utils/wechatIdentity');
const { logOperation } = require('../utils/operationLog');

function publicUser(user) {
  return { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url, phone: user.phone,
    role: user.role, created_at: user.created_at, must_change_password: !!user.must_change_password,
    wechat_bound: !!user.wechat_openid || (user.role === 'customer' && !!user.openid) };
}
function session(user) {
  return { token: generateToken({ id: user.id, role: user.role, tokenVersion: user.token_version || 0 }), user: publicUser(user) };
}
function handleError(res, error) {
  res.status(error.status || 500).json({ success: false, message: error.status ? error.message : '操作失败，请重试' });
}
async function login(req, res) {
  try {
    const { openid, unionid } = await exchangeCode(req.body.code);
    let user = await User.findByOpenid(openid);
    if (!user) {
      try { user = await User.create({ openid, union_id: unionid, nickname: String(req.body.nickname || '微信用户').slice(0, 50), avatar_url: req.body.avatar_url || null, role: 'customer' }); }
      catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; user = await User.findByOpenid(openid); }
    }
    if (user.status !== 'active') return res.status(401).json({ success: false, message: '账号已停用' });
    res.json({ success: true, data: session(user) });
  } catch (error) { handleError(res, error); }
}
async function passwordLogin(req, res, role) {
  try {
    const identifier = String(req.body.phone || req.body.username || req.body.account || '').trim();
    if (!identifier || typeof req.body.password !== 'string' || req.body.password.length > 72) return res.status(400).json({ success: false, message: '请输入账号和密码' });
    const lookup = role === 'worker' ? buildWorkerLoginLookup(identifier) : {
      sql: "SELECT * FROM users WHERE (username=? OR phone=?) AND role='admin' AND status='active' LIMIT 1", params: [identifier, identifier]
    };
    const [rows] = await db.query(lookup.sql, lookup.params);
    const user = rows[0];
    if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ success: false, message: '账号或密码错误' });
    res.json({ success: true, data: session(user) });
  } catch (error) { handleError(res, error); }
}
async function getCurrentUser(req, res) { res.json({ success: true, data: publicUser(req.user) }); }
async function bindWechat(req, res) {
  try {
    const { openid } = await exchangeCode(req.body.code);
    if (req.user.wechat_openid && req.user.wechat_openid !== openid) return res.status(409).json({ success: false, message: '账号已绑定其他微信，请联系管理员' });
    const [result] = await db.query('UPDATE users SET wechat_openid=? WHERE id=? AND (wechat_openid IS NULL OR wechat_openid=?)', [openid, req.user.id, openid]);
    if (!result.affectedRows) return res.status(409).json({ success: false, message: '绑定信息已变化，请刷新' });
    res.json({ success: true, message: '微信已绑定' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: '该微信已绑定其他师傅账号' });
    handleError(res, error);
  }
}
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    if (typeof new_password !== 'string' || new_password.length < 12 || Buffer.byteLength(new_password) > 72 || !/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
      return res.status(400).json({ success: false, message: '新密码需12位以上且包含字母和数字，最多72字节' });
    }
    if (typeof current_password !== 'string' || !req.user.password || !(await bcrypt.compare(current_password, req.user.password))) return res.status(400).json({ success: false, message: '原密码不正确' });
    const hash = await bcrypt.hash(new_password, 12);
    const [result] = await db.query('UPDATE users SET password=?, must_change_password=0, token_version=token_version+1 WHERE id=? AND token_version=?', [hash, req.user.id, req.user.token_version]);
    if (!result.affectedRows) return res.status(409).json({ success: false, message: '账号凭据已变化，请重新登录' });
    const user = await User.findById(req.user.id);
    logOperation({ user_id: user.id, action: 'change_password', detail: '用户修改密码', ip: req.ip });
    res.json({ success: true, data: session(user) });
  } catch (error) { handleError(res, error); }
}
module.exports = { login, getCurrentUser, bindWechat, changePassword,
  adminLogin: (req, res) => passwordLogin(req, res, 'admin'), workerLogin: (req, res) => passwordLogin(req, res, 'worker') };
