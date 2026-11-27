/**
 * Hero 3D scene: floating print products (race bib, sticker, stamp impression, trophy plate, laser-cut hex)
 * drawn to canvas textures and lit in three.js.
 *  - three.js is code-split and only loaded here
 *  - pauses when off-screen / tab hidden, caps pixel-ratio, renders one still frame for reduced-motion users
 *  - falls back to a CSS-3D version when WebGL is unavailable or low-power
 */
import { useEffect, useRef, useState } from 'react';

const webglOk = () => {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
};

export function HeroFallback() {
  return (
    <div className="hero-fallback absolute inset-0" aria-hidden>
      <div className="fcard bg-[#F5C400] text-ink-900" style={{ '--r': '-6deg', left: '8%', top: '14%', width: '58%', height: '42%', animationDelay: '0s' }}>
        <div className="flex h-9 items-center bg-ink-900 px-4 font-display text-sm font-bold tracking-widest text-white">CITY 10K</div>
        <div className="grid h-[70%] place-items-center font-display text-6xl font-bold sm:text-7xl">4821</div>
      </div>
      <div className="fcard grid place-items-center rounded-full bg-copper-500 font-display text-3xl font-bold text-white" style={{ '--r': '8deg', right: '6%', top: '6%', width: '30%', aspectRatio: '1', animationDelay: '-2s' }}>HERO</div>
      <div className="fcard grid place-items-center bg-paper font-display text-xl font-bold tracking-widest text-signal-red ring-4 ring-signal-red/70 ring-inset" style={{ '--r': '-3deg', left: '4%', bottom: '8%', width: '42%', height: '20%', animationDelay: '-4s' }}>APPROVED</div>
      <div className="fcard grid place-items-center bg-gradient-to-br from-[#E8CD83] via-[#B98A2E] to-[#E8CD83] font-serif text-xl italic text-ink-900" style={{ '--r': '5deg', right: '8%', bottom: '12%', width: '44%', height: '22%', animationDelay: '-1s' }}>Champion 2026</div>
    </div>
  );
}

export default function Hero3D({ className = '' }) {
  const mount = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = mount.current;
    if (!el) return undefined;
    const lowPower = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    if (!webglOk() || lowPower) { setFallback(true); return undefined; }

    let disposed = false;
    let cleanup = () => {};

    import('three').then(async (THREE) => {
      if (disposed) return;
      try { await document.fonts?.ready; } catch { /* ignore */ }
      if (disposed) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const coarse = window.matchMedia('(pointer: coarse)').matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const dom = renderer.domElement;
      dom.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
      el.appendChild(dom);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 9.5);
      scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-3, 5, 6); scene.add(key);
      const rim = new THREE.PointLight(0xc77d2e, 55, 26); rim.position.set(5, -2, 3); scene.add(rim);
      const rim2 = new THREE.PointLight(0x6ea37d, 30, 26); rim2.position.set(-6, 3, 2); scene.add(rim2);

      const aniso = renderer.capabilities.getMaxAnisotropy();
      const tex = (w, h, draw) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
      };
      const FD = '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif';
      const FS = '"Instrument Serif", Georgia, serif';
      const centerText = (g, text, x, y, font, color) => { g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y); };

      const mats = (front, edgeColor = 0x1a1a22, opts = {}) => {
        const side = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.7 });
        const face = new THREE.MeshStandardMaterial({ map: front, roughness: opts.rough ?? 0.5, metalness: opts.metal ?? 0.05 });
        const back = new THREE.MeshStandardMaterial({ color: opts.back ?? 0xe9e2d3, roughness: 0.8 });
        return { side, face, back };
      };

      const items = [];
      const add = (mesh, pos, rot, scale, phase) => {
        mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.scale.setScalar(0.0001);
        mesh.userData = { base: new THREE.Vector3(...pos), rot: new THREE.Euler(...rot), scale, phase, born: 0 };
        scene.add(mesh); items.push(mesh);
      };

      // 1) race bib
      {
        const t = tex(600, 440, (g, w, h) => {
          g.fillStyle = '#F5C400'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#0B0C14'; g.fillRect(0, 0, w, 92);
          centerText(g, 'CITY 10K  ·  2026', w / 2, 48, `700 44px ${FD}`, '#FFFFFF');
          centerText(g, '4821', w / 2, 236, `700 228px ${FD}`, '#0B0C14');
          centerText(g, 'A. SHARMA', w / 2, 392, `700 44px ${FD}`, '#0B0C14');
          g.fillStyle = '#C8432F'; [[26, 26], [w - 26, 26]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + 410, 9, 0, 7); g.fill(); });
        });
        const m = mats(t);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.27, 0.07), [m.side, m.side, m.side, m.side, m.face, m.back]);
        add(mesh, [-0.5, 0.55, 0.6], [0.12, -0.32, 0.07], 1.1, 0);
      }
      // 2) round sticker
      {
        const t = tex(512, 512, (g, w) => {
          const grd = g.createRadialGradient(w * 0.4, w * 0.35, 20, w / 2, w / 2, w / 2);
          grd.addColorStop(0, '#E2A85F'); grd.addColorStop(1, '#B26B20'); g.fillStyle = grd; g.fillRect(0, 0, w, w);
          g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, w / 2, w * 0.43, 0, 7); g.stroke();
          g.setLineDash([3, 16]); g.lineWidth = 6; g.beginPath(); g.arc(w / 2, w / 2, w * 0.36, 0, 7); g.stroke(); g.setLineDash([]);
          centerText(g, 'HERO', w / 2, w / 2 - 6, `700 150px ${FD}`, '#FFFFFF');
          centerText(g, 'print · proof · ship', w / 2, w / 2 + 96, `italic 44px ${FS}`, '#FFF4E0');
        });
        const m = mats(t, 0xe2dccb);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 72), [m.side, m.face, m.back]);
        mesh.geometry.rotateX(Math.PI / 2); mesh.geometry.rotateZ(Math.PI); // cap faces the camera, upright
        add(mesh, [2.25, 1.55, -0.7], [0.1, 0.35, 0.12], 1, 1.3);
      }
      // 3) stamp impression
      {
        const t = tex(640, 260, (g, w, h) => {
          g.fillStyle = '#F7F2E8'; g.fillRect(0, 0, w, h);
          g.strokeStyle = '#C8432F'; g.lineWidth = 9; g.strokeRect(18, 18, w - 36, h - 36); g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
          centerText(g, 'APPROVED', w / 2, h / 2 - 14, `700 96px ${FD}`, '#C8432F');
          centerText(g, 'PROOF v2  ·  READY TO PRINT', w / 2, h / 2 + 62, `600 28px ${FD}`, '#C8432F');
        });
        const m = mats(t, 0xc9bfa8);
        add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.1, 0.08), [m.side, m.side, m.side, m.side, m.face, m.back]), [-2.45, -1.35, -0.2], [-0.1, 0.4, -0.12], 1, 2.4);
      }
      // 4) brass trophy plate
      {
        const t = tex(640, 260, (g, w, h) => {
          const grd = g.createLinearGradient(0, 0, w, h);
          grd.addColorStop(0, '#EBD28D'); grd.addColorStop(0.45, '#B98A2E'); grd.addColorStop(1, '#E9CF86'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
          g.strokeStyle = 'rgba(43,29,0,.65)'; g.lineWidth = 5; g.strokeRect(16, 16, w - 32, h - 32);
          centerText(g, 'CHAMPION', w / 2, h / 2 - 22, `italic 92px ${FS}`, '#2B1D00');
          centerText(g, 'CITY 10K · 2026', w / 2, h / 2 + 62, `600 30px ${FD}`, '#2B1D00');
        });
        const m = mats(t, 0x8a6a22, { rough: 0.32, metal: 0.25, back: 0x8a6a22 });
        add(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.14, 0.1), [m.side, m.side, m.side, m.side, m.face, m.back]), [1.45, -1.4, 0.9], [-0.06, -0.38, 0.06], 1, 3.6);
      }
      // 5) laser-cut hexagon
      {
        const t = tex(512, 512, (g, w) => {
          g.fillStyle = '#2F8F8A'; g.fillRect(0, 0, w, w);
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7;
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + Math.cos(a) * w * 0.46, w / 2 + Math.sin(a) * w * 0.46); g.stroke(); }
          g.fillStyle = '#12141F'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.2, 0, 7); g.fill();
          centerText(g, 'DH', w / 2, w / 2 + 4, `700 96px ${FD}`, '#6EA37D');
        });
        const m = mats(t, 0x1d6b67);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 6), [m.side, m.face, m.back]);
        mesh.geometry.rotateX(Math.PI / 2);
        add(mesh, [-2.7, 1.75, -1.5], [0.15, -0.25, 0.3], 1, 4.8);
      }

      // layout / responsiveness
      const group = new THREE.Group(); items.forEach((m) => { scene.remove(m); group.add(m); }); scene.add(group);
      const size = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        const s = Math.min(1, camera.aspect * 0.98) * (w < 480 ? 0.92 : 1);
        group.scale.setScalar(Math.max(0.55, s)); camera.updateProjectionMatrix();
      };
      size();
      const ro = new ResizeObserver(() => { size(); if (reduce) renderer.render(scene, camera); });
      ro.observe(el);

      // pointer parallax
      const target = { x: 0, y: 0 };
      const onMove = (e) => { const r = el.getBoundingClientRect(); target.x = ((e.clientX - r.left) / r.width - 0.5) * 2; target.y = ((e.clientY - r.top) / r.height - 0.5) * 2; };
      if (!coarse) window.addEventListener('pointermove', onMove, { passive: true });

      let visible = true; const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }); io.observe(el);
      const born = performance.now(); const elapsed = () => (performance.now() - born) / 1000;
      const ease = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

      const frame = () => {
        if (!visible || document.hidden) return;
        const t = elapsed();
        items.forEach((m, i) => {
          const u = m.userData;
          const p = Math.min(1, Math.max(0, (t - 0.15 - i * 0.16) / 1.1));
          m.scale.setScalar(Math.max(0.0001, ease(p) * u.scale));
          const fl = reduce ? 0 : Math.sin(t * 0.8 + u.phase);
          m.position.set(u.base.x, u.base.y + fl * 0.18, u.base.z + (1 - p) * 4);
          m.rotation.set(u.rot.x + (reduce ? 0 : Math.sin(t * 0.55 + u.phase) * 0.1), u.rot.y + (reduce ? 0 : Math.cos(t * 0.45 + u.phase) * 0.22) + (1 - p) * 2.4, u.rot.z + (reduce ? 0 : Math.sin(t * 0.35 + u.phase) * 0.05));
        });
        const sway = coarse ? Math.sin(t * 0.4) * 0.35 : target.x;
        group.rotation.y += (sway * 0.28 - group.rotation.y) * 0.05;
        group.rotation.x += (target.y * 0.14 - group.rotation.x) * 0.05;
        renderer.render(scene, camera);
      };
      if (reduce) { items.forEach((m) => m.scale.setScalar(m.userData.scale)); renderer.render(scene, camera); }
      else renderer.setAnimationLoop(frame);

      cleanup = () => {
        renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove);
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); }); });
        renderer.dispose(); renderer.forceContextLoss?.(); dom.remove();
      };
      if (disposed) cleanup();
    }).catch(() => setFallback(true));

    return () => { disposed = true; cleanup(); };
  }, []);

  if (fallback) return <div className={`relative ${className}`}><HeroFallback /></div>;
  return <div ref={mount} className={`relative ${className}`} aria-hidden />;
}
