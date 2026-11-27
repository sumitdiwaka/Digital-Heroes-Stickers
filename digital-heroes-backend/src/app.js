const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);                         // correct client IPs behind Vercel / Render / Nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow the React app to display proof images
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(compression());
if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Stripe webhooks need the RAW body for signature verification -> mounted BEFORE express.json
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());                            // strips $ and . operators from input (NoSQL injection)

if (process.env.DISABLE_RATE_LIMIT !== 'true') {
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } } }));
  app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'], rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } } }));
}

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date().toISOString(), env: env.nodeEnv } }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/catalogue'));   // public: divisions, products, pricing, gallery, designer helpers
app.use('/api', require('./routes/designs'));     // auth-gated per path (/designs, /uploads)
app.use('/api', require('./routes/dashboard'));   // auth-gated per path

app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
