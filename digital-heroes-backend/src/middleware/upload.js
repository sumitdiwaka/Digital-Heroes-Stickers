const multer = require('multer');
const env = require('../config/env');
const { bad } = require('../utils/AppError');

const memory = multer.memoryStorage();
const limits = { fileSize: env.limits.uploadMb * 1024 * 1024, files: 1 };

/** Sniff the real type from file bytes (do not trust the client mime / extension). */
function sniff(buf, originalName = '') {
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.slice(0, 5).toString() === '%PDF-') {
    // Adobe Illustrator .ai files are PDF-compatible containers
    return ext === 'ai' ? { ext: 'ai', mime: 'application/illustrator' } : { ext: 'pdf', mime: 'application/pdf' };
  }
  const head = buf.slice(0, 2048).toString('utf8').toLowerCase();
  if (head.includes('<svg')) return { ext: 'svg', mime: 'image/svg+xml' };
  if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
  return null;
}

const wrap = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(bad(`File too large (max ${env.limits.uploadMb} MB)`));
    next(err.status ? err : bad(err.message));
  });

const single = (field = 'file') => wrap(multer({ storage: memory, limits }).single(field));

module.exports = { single, sniff };
