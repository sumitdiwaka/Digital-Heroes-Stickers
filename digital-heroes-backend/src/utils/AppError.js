// Operational error with an HTTP status + machine readable code.
class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const bad = (m, d) => new AppError(400, m, 'BAD_REQUEST', d);
const unauthorized = (m = 'Authentication required') => new AppError(401, m, 'UNAUTHORIZED');
const forbidden = (m = 'You do not have permission to do that') => new AppError(403, m, 'FORBIDDEN');
const notFound = (m = 'Not found') => new AppError(404, m, 'NOT_FOUND');
const conflict = (m, d) => new AppError(409, m, 'CONFLICT', d);
module.exports = { AppError, bad, unauthorized, forbidden, notFound, conflict };
