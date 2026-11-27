const { AppError } = require('../utils/AppError');
const env = require('../config/env');

const notFoundHandler = (req, _res, next) =>
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) { // mongoose validation
    status = 422; code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400; code = 'BAD_ID'; message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = `Duplicate value: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body';
  }
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    success: false,
    error: { code, message, details, ...(env.isProd || status < 500 ? {} : { stack: err.stack }) },
  });
};
module.exports = { notFoundHandler, errorHandler };
