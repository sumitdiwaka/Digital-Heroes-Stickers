import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, ShieldCheck, ShoppingBag, User, X, Palette } from 'lucide-react';
import Brand from './Brand';
import { Button, cx } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useScrolled } from '../../lib/hooks';

const links = [{ to: '/products', label: 'Products' }, { to: '/gallery', label: 'Gallery' }, { to: '/#how', label: 'How it works' }];

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const scrolled = useScrolled();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname, loc.hash]);

  const linkCls = ({ isActive }) => cx('rounded-lg px-3 py-2 font-display text-sm font-medium text-paper/75 transition hover:text-paper', isActive && 'text-paper');
  return (
    <header className={cx('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-white/10 bg-ink-900/85 backdrop-blur-xl' : 'bg-transparent')}>
      <div className="container-x flex h-[var(--nav-h)] items-center justify-between gap-4">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex on-dark">
          {user ? (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-paper transition hover:border-copper-400" aria-haspopup="menu" aria-expanded={menu}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-copper-500 font-display text-xs font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
                <span className="max-w-[110px] truncate font-display font-medium">{user.name?.split(' ')[0]}</span>
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div initial={{ opacity: 0, y: 8, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: 8 }} style={{ transformPerspective: 600, transformOrigin: 'top right' }}
                    className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 p-1.5 text-paper shadow-2xl" role="menu" onMouseLeave={() => setMenu(false)}>
                    {[[LayoutDashboard, 'Dashboard', '/dashboard'], [ShoppingBag, 'My orders', '/orders'], [Palette, 'Saved designs', '/designs'], [User, 'Profile', '/profile'], ...(isAdmin ? [[ShieldCheck, 'Admin console', '/admin']] : [])].map(([Icon, label, to]) => (
                      <Link key={to} to={to} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/5"><Icon size={16} className="text-copper-400" />{label}</Link>
                    ))}
                    <button onClick={() => { logout(); nav('/'); }} className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-white/10 px-3 py-2.5 text-sm text-paper/70 transition hover:bg-white/5"><LogOut size={16} />Log out</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/login" className="px-2 font-display text-sm font-medium text-paper/80 hover:text-paper">Log in</Link>
              <Button as={Link} to="/products" size="sm">Start an order</Button>
            </>
          )}
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 text-paper md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: '100%', rotateY: -20 }} animate={{ x: 0, rotateY: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} style={{ transformPerspective: 900, transformOrigin: 'right' }}
              className="absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col bg-ink-900 p-5 text-paper on-dark">
              <div className="flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15" aria-label="Close menu"><X size={18} /></button></div>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                {links.map((l) => <Link key={l.to} to={l.to} className="rounded-xl px-3 py-3.5 font-display text-xl font-semibold hover:bg-white/5">{l.label}</Link>)}
                {user && [['/dashboard', 'Dashboard'], ['/orders', 'My orders'], ['/designs', 'Saved designs'], ['/profile', 'Profile'], ...(isAdmin ? [['/admin', 'Admin console']] : [])].map(([to, label]) => <Link key={to} to={to} className="rounded-xl px-3 py-3 text-paper/75 hover:bg-white/5">{label}</Link>)}
              </nav>
              <div className="mt-auto space-y-3 pb-4 safe-b">
                {user ? <Button variant="ghost" className="w-full" onClick={() => { logout(); nav('/'); }}><LogOut size={16} />Log out</Button>
                  : <><Button as={Link} to="/register" className="w-full">Create account</Button><Button as={Link} to="/login" variant="ghost" className="w-full">Log in</Button></>}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
