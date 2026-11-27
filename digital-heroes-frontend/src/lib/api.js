/**
 * Tiny fetch wrapper for the Digital Heroes backend.
 *  - adds the JWT, parses the { success, data, meta, error } envelope, throws ApiError on failure
 *  - fetchBlob / downloadFile for authenticated images and files (no token in URLs)
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY = 'dh_token';

let token = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
export const getToken = () => token;
export function setToken(t) {
  token = t || null;
  if (typeof localStorage === 'undefined') return;
  if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY);
}

export class ApiError extends Error {
  constructor(status, message, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

const qs = (query) => {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.append(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request(method, path, { body, form, query, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(`${BASE}${path}${qs(query)}`, { method, headers, body: payload, signal }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new ApiError(0, 'Cannot reach the server. Check your connection and that the backend is running.', 'NETWORK'); }

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`, 'HTTP');
    return { data: await res.blob(), meta: null };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const e = (json && json.error) || {};
    if (res.status === 401 && token && typeof window !== 'undefined') window.dispatchEvent(new window.Event('dh:unauthorized'));
    throw new ApiError(res.status, e.message || `Request failed (${res.status})`, e.code, e.details);
  }
  return { data: json.data, meta: json.meta || null };
}

// Convenience: resolve to `data` (use *Full to also get meta for paginated lists)
export const api = {
  get: (p, query) => request('GET', p, { query }).then((r) => r.data),
  getFull: (p, query) => request('GET', p, { query }),
  post: (p, body) => request('POST', p, { body }).then((r) => r.data),
  put: (p, body) => request('PUT', p, { body }).then((r) => r.data),
  patch: (p, body) => request('PATCH', p, { body }).then((r) => r.data),
  del: (p) => request('DELETE', p).then((r) => r.data),
  upload: (p, file, field = 'file') => { const f = new FormData(); f.append(field, file); return request('POST', p, { form: f }).then((r) => r.data); },
};

/** Authenticated binary fetch -> Blob */
export async function fetchBlob(path) {
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`, 'HTTP');
  return res.blob();
}

/** Download a protected file through a temporary object URL. */
export async function downloadFile(path, filename) {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const errorText = (e) => {
  if (!e) return 'Something went wrong';
  if (e.details && Array.isArray(e.details) && e.details[0] && e.details[0].message) return `${e.message}: ${e.details.map((d) => d.message).slice(0, 3).join('; ')}`;
  return e.message || 'Something went wrong';
};
