// Central place for environment configuration. Nothing else reads process.env directly.
require('dotenv').config();
const path = require('path');

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 5000),
  clientUrls: (process.env.CLIENT_URLS || 'http://localhost:3000').split(',').map((s) => s.trim()),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:5000',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital_heroes',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  currency: process.env.CURRENCY || 'INR',
  taxName: process.env.TAX_NAME || 'GST',
  taxRate: num(process.env.TAX_RATE, 0.18),
  storageDir: path.resolve(process.env.STORAGE_DIR || './storage'),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Digital Heroes <no-reply@digitalheroes.co.in>',
  },
  limits: {
    uploadMb: 25,
    csvMaxRows: 5000,
  },
};
