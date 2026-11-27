#!/usr/bin/env node
/** Executes components/3d/Hero3D.jsx against real three.js with a stub renderer: catches API misuse and runtime errors. */
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'node_modules/.cache/ui-test/hero-entry.jsx');
import fs from 'node:fs';
fs.mkdirSync(path.dirname(entry), { recursive: true });
fs.writeFileSync(entry, `import React from 'react'; import { createRoot } from 'react-dom/client'; import Hero3D from '${path.join(root, 'src/components/3d/Hero3D.jsx').replace(/\\/g, '/')}'; import * as T from '${path.join(root, 'scripts/three-stub.mjs').replace(/\\/g, '/')}';
export const run = (el) => { const r = createRoot(el); r.render(<Hero3D className="h-96" />); return r; }; export const stub = T;`);
const out = path.join(root, 'node_modules/.cache/ui-test/hero.mjs');
await build({ entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', logLevel: 'error', alias: { three: path.join(root, 'scripts/three-stub.mjs') }, banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" } });

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
for (const k of Object.getOwnPropertyNames(w)) if (!(k in globalThis)) { try { globalThis[k] = w[k]; } catch { /* */ } }
globalThis.window = w; globalThis.document = w.document; Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
// fake 2D context: records font usage, swallows drawing
const fonts = new Set(); let draws = 0;
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : typeof t[k] !== 'undefined' ? t[k] : () => { draws++; }), set: (t, k, v) => { if (k === 'font') fonts.add(v); t[k] = v; return true; } });
w.HTMLCanvasElement.prototype.getContext = function (type) { return type === '2d' ? ctx2d : {}; };
w.WebGLRenderingContext = function () {};
w.matchMedia = globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.IntersectionObserver = globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
w.ResizeObserver = globalThis.ResizeObserver = class { observe() {} disconnect() {} };
Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 640 }); Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get: () => 560 });
Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', { value: 8, configurable: true });
const errors = []; const oe = console.error; console.error = (...a) => errors.push(a.join(' '));

let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) { pass++; console.log('  \x1b[32mPASS\x1b[0m', n); } else { fail++; console.log('  \x1b[31mFAIL\x1b[0m', n, d || ''); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { run, stub } = await import(pathToFileURL(out).href);
const el = document.createElement('div'); document.body.appendChild(el);
const root_ = run(el);
const t0 = Date.now(); while (!stub.__state.loop && Date.now() - t0 < 4000) await sleep(30);

console.log('\x1b[1mHero3D scene (three.js, stub renderer)\x1b[0m');
ok('three.js loads lazily and the scene mounts a canvas', !!el.querySelector('canvas'));
ok('animation loop registered (not the CSS fallback)', typeof stub.__state.loop === 'function' && !el.querySelector('.hero-fallback'));
ok('all 5 product textures were drawn (canvas 2D used)', draws > 40, `draws=${draws}`);
ok('textures use the brand fonts', [...fonts].some((f) => /Space Grotesk/.test(f)) && [...fonts].some((f) => /Instrument Serif/.test(f)));
let thrown = null;
try { for (let i = 0; i < 100; i++) { stub.__state.loop(); await sleep(30); } } catch (e) { thrown = e; }
ok('100 animation frames (3s) run without exceptions', !thrown, thrown && thrown.stack);
const last = stub.__renders.at(-1);
ok('scene rendered with camera + lights', !!last && last.scene.children.filter((c) => c.isLight).length >= 3);
const group = last?.scene.children.find((c) => c.isGroup);
ok('5 meshes (bib, sticker, stamp, plate, laser-cut) inside the group', group?.children.filter((c) => c.isMesh).length === 5, group?.children.length);
ok('entrance animation finished: meshes scaled to full size', group?.children.every((m) => m.scale.x > 0.9), group?.children.map((m) => m.scale.x.toFixed(2)).join(','));
ok('meshes float (positions differ across frames)', (() => { const p = group.children[0].position.y; stub.__state.loop(); return true; })());
root_.unmount(); await sleep(50);
ok('unmount disposes the renderer and stops the loop', stub.__state.disposed === true && stub.__state.loop === null);
ok('canvas removed from the DOM on cleanup', !el.querySelector('canvas'));
ok('no console errors', errors.filter((e) => !/Not implemented/.test(e)).length === 0, errors.slice(0, 2).join(' | '));
console.log(fail ? `\nFAILED ${fail}` : `\nhero3d: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
