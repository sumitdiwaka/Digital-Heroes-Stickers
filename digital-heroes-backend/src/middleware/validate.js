const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

/** validate({ body: schema, query: schema, params: schema }) - replaces req parts with parsed values. */
const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req[part] = schemas[part].parse(req[part] || {});
    }
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      const details = e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(new AppError(422, 'Validation failed', 'VALIDATION_ERROR', details));
    }
    next(e);
  }
};
module.exports = validate;
