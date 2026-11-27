import { Link } from 'react-router-dom';
import Brand from './Brand';

export default function Footer() {
  return (
    <footer className="on-dark relative overflow-hidden bg-ink-900 text-paper">
      <div className="grid-lines absolute inset-0 opacity-60" aria-hidden />
      <div className="container-x relative py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">Six print divisions, one owned platform. Configure, design, proof and order - and we turn your approved proof into production-ready files.</p>
          </div>
          <div><h4 className="kicker-dark kicker mb-4">Divisions</h4><ul className="space-y-2 text-sm text-paper/70">
            {[['labels-stickers', 'Labels & Stickers'], ['race-event-numbers', 'Race & Event Numbers'], ['mtb-boards', 'MTB Boards'], ['stamps', 'Stamps'], ['trophies', 'Trophies'], ['laser-cut', 'Laser-Cut Work']].map(([s, n]) => <li key={s}><Link className="transition hover:text-copper-300" to={`/division/${s}`}>{n}</Link></li>)}
          </ul></div>
          <div><h4 className="kicker-dark kicker mb-4">Account</h4><ul className="space-y-2 text-sm text-paper/70">
            <li><Link className="hover:text-copper-300" to="/dashboard">Dashboard</Link></li><li><Link className="hover:text-copper-300" to="/orders">Orders</Link></li><li><Link className="hover:text-copper-300" to="/designs">Saved designs</Link></li><li><Link className="hover:text-copper-300" to="/login">Log in</Link></li>
          </ul></div>
          <div><h4 className="kicker-dark kicker mb-4">Company</h4><ul className="space-y-2 text-sm text-paper/70">
            <li><Link className="hover:text-copper-300" to="/gallery">Work gallery</Link></li><li><Link className="hover:text-copper-300" to="/#how">How it works</Link></li><li><a className="hover:text-copper-300" href="https://digitalheroes.co.in" target="_blank" rel="noreferrer">digitalheroes.co.in</a></li>
          </ul></div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 font-mono text-[11px] uppercase tracking-widest text-paper/40">
          <span>© {new Date().getFullYear()} Digital Heroes</span><span>Proof it · Approve it · Print it</span>
        </div>
      </div>
    </footer>
  );
}
