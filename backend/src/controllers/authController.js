const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { buildWorkerLoginLookup } = require('../utils/workerLoginLookup');
const wechatConfig = require('../config/wechat');

/**
 * 微信登录
 * @route POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { code, nickname, avatar_url } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '缺少code参数'
      });
    }

    // 调用微信API获取openid
    const wxResponse = await axios.get(wechatConfig.loginUrl, {
      params: {
        appid: wechatConfig.appId,
        secret: wechatConfig.appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const { openid, session_key, unionid, errcode, errmsg } = wxResponse.data;

    // 检查微信API是否返回错误
    if (errcode) {
      console.error('微信登录错误:', errcode, errmsg);
      return res.status(400).json({
        success: false,
        message: `微信登录失败: ${errmsg}`,
        errcode
      });
    }

    if (!openid) {
      return res.status(400).json({
        success: false,
        message: '获取openid失败'
      });
    }

    // 查找或创建用户
    let user = await User.findByOpenid(openid);

    if (user) {
      // 用户已存在，更新信息
      if (nickname || avatar_url) {
        user = await User.update(user.id, {
          nickname: nickname || user.nickname,
          avatar_url: avatar_url || user.avatar_url,
          phone: user.phone
        });
      }
    } else {
      // 创建新用户
      user = await User.create({
        openid,
        union_id: unionid,
        nickname: nickname || '微信用户',
        avatar_url: avatar_url || null,
        role: 'customer'
      });
    }

    // 生成JWT token
    const token = generateToken({
      userId: user.id,
      openid: user.openid,
      role: user.role
    });

    // 返回用户信息和token
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
}

/**
 * 获取当前用户信息
 * @route GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    const user = req.user; // 从auth中间件获取

    res.json({
      success: true,
      data: {
        id: user.id,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: error.message
    });
  }
}

/**
 * 管理员账号密码登录（管理后台使用）
 * @route POST /api/auth/admin-login
 */
async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入账号和密码'
      });
    }

    // 查询管理员账号（username 存在 users 表的 username 字段，或用手机号）
    const [users] = await db.query(
      `SELECT * FROM users 
       WHERE (username = ? OR phone = ?) AND role = 'admin' AND status = 'active'
       LIMIT 1`,
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '账号或密码错误'
      });
    }

    const user = users[0];

    // 验证密码（兼容未设置密码的账号）
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: '该账号未设置密码，请联系系统管理员'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '账号或密码错误'
      });
    }

    // 生成 token
    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('管理员登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
}

/**
 * 师傅端账号+密码登录（手机号 / 工号 username / 数字 ID）
 * @route POST /api/auth/worker-login
 */
async function workerLogin(req, res) {
  try {
    const { phone, password, username, account } = req.body;
    const identifier = String(phone || username || account || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入手机号/工号和密码'
      });
    }

    const lookup = buildWorkerLoginLookup(identifier);
    const [users] = await db.query(lookup.sql, lookup.params);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '账号或密码错误'
      });
    }

    const user = users[0];

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: '该账号未设置密码，请联系管理员重置'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '账号或密码错误'
      });
    }

    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('师傅登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
}

module.exports = {
  login,
  adminLogin,
  workerLogin,
  getCurrentUser
};
