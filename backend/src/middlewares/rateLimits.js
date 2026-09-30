const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');
const options = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: '操作过于频繁，请等待约15分钟后再试' } };
const loginIpLimit = rateLimit({ ...options, limit: 40 });
const loginAccountLimit = rateLimit({ ...options, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: req => {
    const account = String(req.body.phone || req.body.username || req.body.account || '').trim().toLowerCase();
    return account ? crypto.createHash('sha256').update(account).digest('hex') : ipKeyGenerator(req.ip);
  } });
const uploadLimit = rateLimit({ ...options, limit: 30, keyGenerator: req => String(req.user.id) });
module.exports = { loginIpLimit, loginAccountLimit, uploadLimit };
