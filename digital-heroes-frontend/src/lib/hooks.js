import { useEffect, useRef, useState } from 'react';
import { fetchBlob } from './api';

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function usePageTitle(title) {
  useEffect(() => { document.title = title ? `${title} | Digital Heroes` : 'Digital Heroes | Web-to-print, made properly'; }, [title]);
}

/** Authenticated image -> object URL. Re-fetches when `path` or `version` changes. */
export function useAuthedImage(path, version = 0) {
  const [state, setState] = useState({ url: null, loading: !!path, error: null });
  useEffect(() => {
    if (!path) { setState({ url: null, loading: false, error: null }); return undefined; }
    let alive = true, objUrl = null;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchBlob(path)
      .then((b) => { objUrl = URL.createObjectURL(b); if (alive) setState({ url: objUrl, loading: false, error: null }); })
      .catch((e) => alive && setState({ url: null, loading: false, error: e }));
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [path, version]);
  return state;
}

export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query); const h = () => setM(mq.matches);
    mq.addEventListener('change', h); h();
    return () => mq.removeEventListener('change', h);
  }, [query]);
  return m;
}
export const useReducedMotionPref = () => useMedia('(prefers-reduced-motion: reduce)');
export const useIsDesktop = () => useMedia('(min-width: 1024px)');

/** Smoothly tween a number (used for the live price). */
export function useTween(target, ms = 450) {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = target;
    if (a === b) return undefined;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3);
      const v = a + (b - a) * e; setVal(v); from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

export function useScrolled(px = 12) {
  const [s, setS] = useState(false);
  useEffect(() => { const h = () => setS(window.scrollY > px); h(); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h); }, [px]);
  return s;
}

/** true once the element has been scrolled into view (lazy-render expensive previews) */
export function useInView(rootMargin = '200px') {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return undefined;
    if (!('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin });
    io.observe(el); return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}
