/**
 * Storage abstraction. Local-disk driver today. To move to S3 / Supabase Storage / GCS,
 * re-implement these 6 functions - nothing else in the codebase touches the filesystem.
 * Keys are POSIX style relative paths, e.g. "orders/DH-261125-0001/file.pdf".
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const env = require('../config/env');

const abs = (key) => {
  const p = path.resolve(env.storageDir, key);
  if (!p.startsWith(env.storageDir)) throw new Error('Invalid storage key'); // path traversal guard
  return p;
};

async function put(key, buffer) {
  const p = abs(key);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, buffer);
  return { key, size: buffer.length };
}
const read = (key) => fsp.readFile(abs(key));
const stream = (key) => fs.createReadStream(abs(key));
const sendTo = (res, key) => {
  const s = fs.createReadStream(abs(key));
  s.on('error', () => {
    if (!res.headersSent) res.status(404).type('application/json').send(JSON.stringify({ success: false, error: { code: 'FILE_MISSING', message: 'This file is no longer available on the server' } }));
    else res.destroy();
  });
  s.pipe(res);
};
const exists = async (key) => { try { await fsp.access(abs(key)); return true; } catch { return false; } };
const remove = (key) => fsp.rm(abs(key), { force: true, recursive: true });
const absolutePath = abs; // used only by local-driver helpers (zip streaming)

module.exports = { put, read, stream, exists, remove, absolutePath,sendTo };
