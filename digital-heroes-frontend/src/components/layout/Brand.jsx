import { Link } from 'react-router-dom';
export const Mark = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#0B0C14" stroke="#2A2E40" /><path d="M14 18h20a14 14 0 0 1 0 28H14z" fill="none" stroke="#C77D2E" strokeWidth="6" strokeLinejoin="round" /><circle cx="46" cy="18" r="4" fill="#6EA37D" /></svg>
);
export default function Brand({ dark = true, to = '/' }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="Digital Heroes home">
      <span className="transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105"><Mark /></span>
      <span className={`font-display text-lg font-bold leading-none tracking-tight ${dark ? 'text-paper' : 'text-ink-900'}`}>digital<span className="text-copper-500">.</span><span className="block font-mono text-[9px] font-medium uppercase tracking-[.3em] opacity-60">heroes</span></span>
    </Link>
  );
}
