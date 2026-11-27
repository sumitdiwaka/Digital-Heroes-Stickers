const router = require('express').Router();
const crypto = require('crypto');
const { User } = require('../models');
const { signToken, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { auth: v } = require('../validators');
const { conflict, unauthorized, bad } = require('../utils/AppError');
const email = require('../services/email');
const env = require('../config/env');

// POST /api/auth/register  -> always creates a CUSTOMER (admins are created via seed / admin API)
router.post('/register', validate({ body: v.register }), asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw conflict('An account with this email already exists');
  const user = new User({ name: req.body.name, email: req.body.email, phone: req.body.phone, company: req.body.company, role: 'customer' });
  await user.setPassword(req.body.password);
  await user.save();
  res.status(201).json({ success: true, data: { user: user.toSafeJSON(), token: signToken(user) } });
}));

// POST /api/auth/login
router.post('/login', validate({ body: v.login }), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // same message for unknown email / wrong password (no account enumeration)
  if (!user || !(await user.checkPassword(req.body.password))) throw unauthorized('Invalid email or password');
  if (!user.isActive) throw unauthorized('This account has been disabled');
  user.lastLoginAt = new Date(); await user.save();
  res.json({ success: true, data: { user: user.toSafeJSON(), token: signToken(user) } });
}));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ success: true, data: { user: req.user.toSafeJSON() } }));

// PATCH /api/auth/me  (profile)
router.patch('/me', requireAuth, validate({ body: v.profile }), asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
}));

// POST /api/auth/change-password
router.post('/change-password', requireAuth, validate({ body: v.changePassword }), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select('+passwordHash');
  if (!(await u.checkPassword(req.body.currentPassword))) throw bad('Current password is incorrect');
  await u.setPassword(req.body.newPassword); await u.save();
  res.json({ success: true, data: { message: 'Password updated' } });
}));

// POST /api/auth/forgot-password  (always 200 - never reveals whether the email exists)
router.post('/forgot-password', validate({ body: v.forgot }), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const out = { success: true, data: { message: 'If that email exists, a reset link has been sent' } };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordReset = { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600 * 1000) };
    await user.save();
    await email.passwordReset(user, `${env.clientUrls[0]}/reset-password?token=${token}`);
    if (!env.isProd) out.data.devToken = token; // convenience for testing only; never returned in production
  }
  res.json(out);
}));

// POST /api/auth/reset-password
router.post('/reset-password', validate({ body: v.reset }), asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const user = await User.findOne({ 'passwordReset.tokenHash': hash, 'passwordReset.expiresAt': { $gt: new Date() } }).select('+passwordHash +passwordReset');
  if (!user) throw bad('Reset token is invalid or expired');
  await user.setPassword(req.body.newPassword);
  user.passwordReset = undefined; await user.save();
  res.json({ success: true, data: { message: 'Password has been reset. You can log in now.' } });
}));

module.exports = router;
