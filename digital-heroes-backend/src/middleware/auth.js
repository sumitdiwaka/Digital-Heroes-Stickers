const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

function readToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.query && req.query.token) return String(req.query.token); // allows <img src> / download links
  return null;
}

async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret); } catch { throw unauthorized('Invalid or expired token'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized('Account not found or disabled');
  return user;
}

/** Requires a valid login. */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
});

/** Login optional - req.user is set when a valid token is present (used by public endpoints). */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
});

/** Role gate. Usage: requireRole('admin') */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
