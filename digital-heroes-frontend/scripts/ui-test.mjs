#!/usr/bin/env node
/**
 * UI integration test: runs the REAL React app in jsdom against the LIVE backend and drives it like a user.
 *   1. start the backend (seeded)         2. npm run test:ui          (API_URL=http://localhost:5000 by default)
 * No browser needed. Covers routing, data loading, forms, the designer, checkout, proof approval, reorder and the admin console.
 */
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const API = process.env.API_URL || 'http://localhost:5000';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.cache/ui-test/harness.mjs');

// ---------- bundle the app for Node
await build({
  entryPoints: [path.join(root, 'scripts/harness.jsx')], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', logLevel: 'error',
  loader: { '.css': 'empty', '.woff2': 'empty', '.svg': 'empty' },
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(API), 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': '""', 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});

// ---------- fake browser
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/', pretendToBeVisual: true });
const w = dom.window;
for (const k of Object.getOwnPropertyNames(w)) { if (!(k in globalThis)) { try { globalThis[k] = w[k]; } catch { /* ignore */ } } }
globalThis.window = w; globalThis.document = w.document; globalThis.localStorage = w.localStorage; globalThis.sessionStorage = w.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
w.matchMedia = globalThis.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
class IO { constructor(cb) { this.cb = cb; } observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, target: el }]), 0); } unobserve() {} disconnect() {} }
class RO { observe() {} unobserve() {} disconnect() {} }
w.IntersectionObserver = globalThis.IntersectionObserver = IO; w.ResizeObserver = globalThis.ResizeObserver = RO;
w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.HTMLCanvasElement.prototype.getContext = () => null;
w.requestAnimationFrame = globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16); w.cancelAnimationFrame = globalThis.cancelAnimationFrame = clearTimeout;
sessionStorage.setItem('dh_splash', '1');

const consoleErrors = [];
const origErr = console.error;
console.error = (...a) => { const m = a.map(String).join(' '); if (!/Not implemented|act\(/.test(m)) consoleErrors.push(m.slice(0, 600)); };
let crashed = null; w.addEventListener('error', (e) => { crashed = e.message; });

const { mount, setToken } = await import(pathToFileURL(out).href);

// ---------- tiny test framework
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
let pass = 0, fail = 0; const failed = [];
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ${c.g('PASS')} ${name}`); } else { fail++; failed.push(name); console.log(`  ${c.r('FAIL')} ${name}${detail ? c.d('\n        -> ' + String(detail).slice(0, 400)) : ''}`); } return cond; };
const section = (t) => console.log(`\n${c.b(t)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let app = null; let container = null;
const text = () => container.textContent.replace(/\s+/g, ' ');
const waitFor = async (fn, ms = 9000) => { const t0 = Date.now(); let last; while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) { last = e; } await sleep(60); } if (last) throw last; return null; };
const waitText = (t, ms) => waitFor(() => text().includes(t), ms);
const el = (sel, t) => Array.from(container.querySelectorAll(sel)).find((e) => !t || e.textContent.replace(/\s+/g, ' ').includes(t));
const click = (e) => e.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const setInput = (e, v) => { const proto = e.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v); e.dispatchEvent(new w.Event('input', { bubbles: true })); };
async function open(url) { if (app) { app.root.unmount(); container.remove(); } container = w.document.createElement('div'); w.document.body.appendChild(container); app = mount(container, url); await sleep(30); return app; }
const api = async (method, p, { token, body, form } = {}) => { const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json'; const r = await fetch(API + p, { method, headers: h, body: form || (body ? JSON.stringify(body) : undefined) }); return r.json().catch(() => null); };

async function login(email, password) {
  await open('/login');
  await waitText('Welcome back');
  setInput(el('input[type=email]'), email); setInput(el('input[autocomplete=current-password]'), password);
  click(el('button[type=submit]'));
}

try {
  console.log(c.b(`Digital Heroes UI integration test  ->  ${API}`));
  const health = await fetch(`${API}/api/health`).catch(() => null);
  if (!health || !health.ok) { console.log(c.r('Backend not reachable. Start it first (npm run seed && npm run dev).')); process.exit(2); }

  // =============================================================== public pages
  section('1. Public pages (no login)');
  localStorage.clear(); setToken(null);
  await open('/');
  ok('home renders hero headline', await waitText('Design it.'));
  ok('home: six division tiles from the API', await waitFor(() => ['Labels & Stickers', 'Race & Event Numbers', 'MTB Boards', 'Stamps', 'Trophies', 'Laser-Cut Work'].every((n) => text().includes(n))));
  ok('home: instant price calculator shows a live price', await waitFor(() => /₹\s?[\d,]+\.\d{2}/.test(el('#pricing')?.textContent || '')), el('#pricing')?.textContent.slice(0, 200));
  ok('home: how-it-works + production sections', text().includes('Approval gate') && text().includes('CSV variable-data merge'));

  await open('/products');
  ok('catalogue lists products as configurable cards', await waitText('Custom Stickers & Labels') && text().includes('Race & Event Numbers'));

  await open('/division/race-event-numbers');
  ok('division page shows its product', await waitText('CSV bulk'));

  await open('/products/custom-stickers');
  ok('configurator: renders options (size, material, quantity)', await waitText('Custom size') && text().includes('Gloss paper'));
  ok('configurator: live price 100 x 50x50 paper = ₹737.50 (5% volume discount)', await waitFor(() => text().includes('₹737.50')), text().match(/₹[\d,.]+/g)?.join(' '));
  ok('configurator: volume discount table + CTAs', text().includes('Volume discounts') && !!el('button', 'Design online') && !!el('button', 'Upload artwork'));
  const qty = el('input[aria-label=Quantity]');
  setInput(qty, '1000'); qty.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true })); 
  ok('configurator: changing quantity re-prices (1000 pcs @ 20% off)', await waitFor(() => /-20%/.test(text())), text().match(/-\d+%/g)?.join(' '));
  setInput(qty, '5');
  ok('configurator: below-minimum quantity shows the server error', await waitText('Minimum quantity is 25'));
  await open('/products/does-not-exist');
  ok('unknown product shows an error (not a blank page)', await waitText('Product not found') || await waitText('not found'));

  await open('/gallery');
  ok('gallery groups work by division', await waitText('All work') && await waitText('Craft beer labels'));
  await open('/nope/nothing');
  ok('404 page', await waitText('Page not found'));

  // =============================================================== guards
  section('2. Route guards');
  await open('/dashboard');
  ok('anonymous /dashboard -> redirected to /login', await waitFor(() => app.path() === '/login'));
  await open('/admin');
  ok('anonymous /admin -> redirected to /login', await waitFor(() => app.path() === '/login'));

  // =============================================================== auth
  section('3. Registration & login (through the UI)');
  const email = `ui_${Math.random().toString(36).slice(2, 8)}@test.com`;
  await open('/register');
  await waitText('Create your');
  setInput(el('input[autocomplete=name]'), 'UI Tester'); setInput(el('input[type=email]'), email); setInput(el('input[autocomplete=new-password]'), 'weak');
  click(el('button[type=submit]'));
  ok('weak password -> field error from the API', await waitText('Password') && await waitFor(() => /At least 8 characters|Needs a/i.test(text())), text().slice(0, 300));
  setInput(el('input[autocomplete=new-password]'), 'Passw0rd!x'); click(el('button[type=submit]'));
  ok('register -> lands on the dashboard', await waitFor(() => app.path() === '/dashboard') && await waitText('Account status'));
  await login('customer@digitalheroes.test', 'WrongPass1');
  const wrongShown = await waitText('Invalid email or password', 5000);
  ok('wrong password shows an error and stays on /login', wrongShown && app.path() === '/login', `path=${app.path()} text=${text().slice(250, 700)}`);

  await login('customer@digitalheroes.test', 'Customer@12345');
  ok('login -> dashboard', await waitFor(() => app.path() === '/dashboard') && await waitText('Hello, Test'));
  const mods = ['Account status', 'Active proofs', 'Order history', 'Invoices', 'Saved designs', 'One-click reorder'];
  ok('dashboard has all six required modules', await waitFor(() => mods.every((m) => text().includes(m))), mods.filter((m) => !text().includes(m)).join(', '));
  await open('/orders'); ok('orders history page', await waitText('Your orders') || await waitText('orders.'));
  await open('/designs'); ok('saved designs page', await waitFor(() => /Saved\s*designs/.test(text())));
  await open('/profile'); ok('profile page shows seeded customer', await waitFor(() => el('input[disabled]')?.value === 'customer@digitalheroes.test'));
  await open('/admin'); ok('customer opening /admin is bounced to the dashboard', await waitFor(() => app.path() === '/dashboard'));

  // =============================================================== designer -> order -> pay -> approve
  section('4. Designer -> quote -> CSV -> checkout -> proof approval');
  await open('/designer/race-bibs?size=bib-190x140&material=tyvek&qty=12');
  ok('designer opens with a start-from picker', await waitText('How do you want to start?'));
  click(el('button', 'Classic bib'));
  ok('template instantiated on the canvas (SVG text elements)', await waitFor(() => container.querySelectorAll('svg.editor-canvas text').length >= 3), container.querySelectorAll('svg text').length);
  ok('canvas shows print-area overlays (trim + safe)', container.querySelectorAll('svg.editor-canvas rect[stroke-dasharray]').length >= 2);
  ok('server validation: design is print-ready', await waitText('Print-ready', 12000));
  click(el('button', 'Add'.length ? 'Text' : 'Text'));
  ok('adding a text element creates a layer', await waitFor(() => container.querySelectorAll('svg.editor-canvas text').length >= 4));
  click(el('button', 'Continue'));
  ok('Continue saves the design and creates a quote', await waitFor(() => /^\/orders\/[a-f0-9]{24}$/.test(app.path()), 12000), app.path());
  const orderId = app.path().split('/')[2];
  ok('order page: quote with CSV panel and pay button', await waitText('Bulk data (CSV)') && !!el('a', 'Pay ₹'), text().slice(0, 200));

  // CSV through the API (file inputs are not practical in jsdom), then the UI picks the new quantity up
  const tok = JSON.parse(JSON.stringify({ t: localStorage.getItem('dh_token') })).t;
  const csv = fs.readFileSync(path.join(root, 'scripts/fixtures/race_numbers.csv'));
  const form = new FormData(); form.append('file', new Blob([csv], { type: 'text/csv' }), 'race_numbers.csv');
  const up = await api('POST', `/api/orders/${orderId}/csv`, { token: tok, form });
  ok('CSV accepted by the API (10 rows)', up?.data?.rowCount === 10, JSON.stringify(up).slice(0, 200));
  await open(`/orders/${orderId}`);
  ok('order page reflects the CSV (10 rows, quantity 10)', await waitText('10 rows') && await waitFor(() => /Quantity\s*10/.test(text())));

  click(el('a', 'Pay ₹'));
  ok('Pay -> checkout page in test mode', await waitFor(() => app.path() === `/checkout/${orderId}`) && await waitText('Test payment mode'));
  click(el('button', 'Pay ₹'));
  ok('mock payment succeeds', await waitText('Payment received'));
  ok('auto-redirect to the order with proof v1 ready for review', await waitFor(() => app.path() === `/orders/${orderId}` && text().includes('Proof review'), 12000) && !!el('button', 'Approve proof v1'), text().slice(0, 300));
  ok('stepper + approval-log present', !!el('ol[aria-label="Order progress"]') && await waitText('Approval log'));

  click(el('button', 'Request changes'));
  ok('request-changes modal opens', await waitText('Tell us what to change'));
  const ta = el('textarea'); setInput(ta, 'Please enlarge the event title');
  click(Array.from(container.querySelectorAll('button')).reverse().find((b) => b.textContent.includes('Send request')));
  ok('change request recorded', await waitText('Changes requested', 8000));
  // artwork update through the API creates v2 (the designer round-trip is covered above)
  const od = await api('GET', `/api/orders/${orderId}`, { token: tok });
  const els = od.data.order.designSnapshot.elements.map((e) => { const o = {}; for (const k of ['id', 'type', 'x', 'y', 'width', 'height', 'rotation', 'text', 'variableKey', 'fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'minFontSize', 'maxFontSize', 'tracking', 'minTracking', 'shrinkToFit', 'align', 'color', 'fill'] ) if (e[k] !== undefined && e[k] !== null) o[k] = e[k]; if (e.type !== 'text') for (const k of ['fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'minFontSize', 'maxFontSize', 'tracking', 'minTracking', 'shrinkToFit', 'align', 'color']) delete o[k]; return o; });
  const put = await api('PUT', `/api/orders/${orderId}/artwork`, { token: tok, body: { elements: els } });
  ok('API artwork update creates proof v2', put?.data?.newProofVersion === 2, JSON.stringify(put).slice(0, 200));
  await open(`/orders/${orderId}`);
  ok('UI shows v2 awaiting review', await waitFor(() => !!el('button', 'Approve proof v2')));
  click(el('button', 'Approve proof v2'));
  ok('approve confirmation modal', await waitText('Approve proof v2?'));
  click(Array.from(container.querySelectorAll('button')).reverse().find((b) => b.textContent.includes('Yes, approve')));
  ok('proof approved -> files locked-in notice', await waitText('Approved proof v2', 10000) && await waitText('Artwork can no longer be changed'));
  ok('approval log lists approval by the customer', await waitFor(() => /approved by/i.test(text())));

  // =============================================================== reorder
  section('5. One-click reorder');
  ok('Reorder button available after approval', !!el('button', 'Reorder'));
  click(el('button', 'Reorder'));
  ok('reorder -> checkout of the new quote (artwork carried over)', await waitFor(() => /^\/checkout\/[a-f0-9]{24}$/.test(app.path()), 10000), app.path());
  const reId = app.path().split('/')[2];
  await waitText('Test payment mode'); click(el('button', 'Pay ₹'));
  ok('reorder paid -> proof already approved (carried over)', await waitFor(() => app.path() === `/orders/${reId}` && text().includes('Approved proof v1'), 14000), text().slice(0, 200));
  await open('/dashboard');
  ok('dashboard now lists invoices and reorder candidates', await waitFor(() => /INV-\d{4}-\d{5}/.test(text())) && !!el('button', 'Reorder'));
  await open('/designs');
  ok('saved designs shows the approved design', await waitFor(() => text().includes('Approved') && !!el('a', 'Edit')));

  // =============================================================== admin
  section('6. Admin console');
  await login('admin@digitalheroes.test', 'Admin@12345');
  ok('admin login -> /admin overview', await waitFor(() => app.path() === '/admin') && await waitText('Shop floor'));
  ok('overview: pipeline stages + KPI tiles', await waitFor(() => ['Quote', 'Proof', 'In production', 'Completed'].every((s) => text().includes(s)) && text().includes('Ready for production')));
  await open('/admin/orders');
  ok('job pipeline lists orders with filters', await waitFor(() => text().includes('DH-') && !!el('input[aria-label="Search order number"]')));
  await open('/admin/orders?status=proof');
  ok('status filter applies via the URL', await waitFor(() => !!el('button.chip-on', 'Proof')));
  await open(`/admin/orders/${orderId}`);
  ok('job ticket opens: unlocked files + approved proof', await waitText('Production files') && await waitText('Unlocked'));
  ok('print files generated (10 rows -> row PDFs)', await waitFor(() => text().includes('row-0001') && text().includes('manifest'), 20000), text().slice(0, 300));
  ok('download-all enabled once the job is done', await waitFor(() => { const b = el('button', 'Download all'); return b && !b.disabled; }));
  ok('proofs + approval log with customer name', text().includes('v2') && /approved/.test(text()) && text().includes('Customer'));
  await open('/admin/users'); ok('users page lists accounts', await waitFor(() => text().includes('Test Customer') && text().includes('Hero Admin')));
  await open('/admin/catalogue'); ok('catalogue admin lists products with live toggles', await waitFor(() => text().includes('Custom Stickers & Labels') && text().includes('live')));
  click(el('button', 'Divisions') || el('[role=tab]', 'Divisions'));
  ok('divisions tab', await waitFor(() => text().includes('labels-stickers')));
  await open('/admin/reports'); ok('reports: revenue, throughput, top customers', await waitFor(() => text().includes('Revenue (incl. tax)') && text().includes('Product-family throughput') && text().includes('Top customers')));
  await open(`/admin/orders/${orderId}`); await waitText('Production files');
  const adv = el('button', 'Send to production'); ok('admin can send an approved job to production', !!adv && !adv.disabled);
  click(adv); await waitText('Send to production?'); click(Array.from(container.querySelectorAll('button')).reverse().find((b) => b.textContent.trim() === 'Send to production'));
  ok('job moved to production', await waitFor(() => /In production/.test(text()) && !!el('button', 'Mark completed'), 8000));

  // =============================================================== hygiene
  section('7. Runtime hygiene');
  const keyWarn = consoleErrors.filter((m) => /unique "key"|Cannot update a component|Maximum update depth|is not a function|Cannot read/i.test(m));
  ok('no React key / render-loop / runtime errors', keyWarn.length === 0, keyWarn.slice(0, 3).join('\n'));
  ok('no uncaught exceptions', !crashed, crashed);
  if (consoleErrors.length) { console.log(c.d(`  (${consoleErrors.length} console.error lines, unique:)`)); [...new Set(consoleErrors)].slice(0, 6).forEach((m) => console.log(c.d('   · ' + m))); }
} catch (e) {
  console.log(c.r(`\nTest aborted: ${e.stack || e}`)); fail++; failed.push('aborted');
  try { console.log(c.d('Last page text: ' + text().slice(0, 500))); console.log(c.d('Path: ' + app?.path())); } catch { /* ignore */ }
}
console.log('\n' + '='.repeat(60));
console.log(`${c.b('RESULT')}: ${c.g(pass + ' passed')}, ${fail ? c.r(fail + ' failed') : '0 failed'}`);
if (fail) failed.forEach((f) => console.log(c.r('  - ' + f)));
process.exit(fail ? 1 : 0);
