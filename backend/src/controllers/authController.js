const axios = require('axios');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
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

module.exports = {
  login,
  getCurrentUser
};
