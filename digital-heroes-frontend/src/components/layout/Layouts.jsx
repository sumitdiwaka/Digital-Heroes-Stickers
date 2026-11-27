import { Suspense, useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Boxes, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Users, X, Home } from 'lucide-react';
import { useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import Brand from './Brand';
import { PageLoader, cx, Spinner } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useReducedMotionPref } from '../../lib/hooks';

/** 3D page entrance */
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotionPref();
  const [animating, setAnimating] = useState(true);
  useEffect(() => { setAnimating(true); }, [pathname]);
  if (reduce) return <div>{children}</div>;
  // perspective only while animating: a lingering transform makes this wrapper the containing block of every position:fixed child
  return (
    <motion.div key={pathname} style={animating ? { transformPerspective: 1200 } : undefined}
      initial={{ opacity: 0, y: 18, rotateX: 4 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
      onAnimationComplete={() => setAnimating(false)} transition={{ duration: .5, ease: [.2, .7, .2, 1] }}>
      {children}
    </motion.div>
  );
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) { const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); return () => clearTimeout(t); }
    window.scrollTo(0, 0); return undefined;
  }, [pathname, hash]);
  return null;
}

export function PublicLayout({ dark }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <Navbar />
      <main className={cx('flex-1', !dark && 'pt-[var(--nav-h)]')}>
        <Suspense fallback={<PageLoader />}><PageTransition><Outlet /></PageTransition></Suspense>
      </main>
      <Footer />
    </div>
  );
}

/** Navbar sits on a dark band so it stays legible on light pages */
export function PageBand({ children }) {
  return <div className="on-dark relative -mt-[var(--nav-h)] overflow-hidden bg-ink-900 pb-12 pt-[calc(var(--nav-h)+2.5rem)] text-paper"><div className="grid-lines absolute inset-0" aria-hidden /><div className="container-x relative">{children}</div></div>;
}

export function RequireAuth({ children, admin }) {
  const { user, loading, isAdmin } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center bg-paper"><Spinner size={28} /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

const accountTabs = [['/dashboard', 'Dashboard'], ['/orders', 'Orders'], ['/designs', 'Saved designs'], ['/profile', 'Profile']];
export function AccountLayout() {
  return (
    <>
      <PageBand>
        <span className="kicker">Your account</span>
        <nav className="no-scrollbar -mx-1 mt-4 flex gap-1 overflow-x-auto" aria-label="Account">
          {accountTabs.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('whitespace-nowrap rounded-xl px-4 py-2.5 font-display text-sm font-semibold transition', isActive ? 'bg-copper-500 text-white shadow-glow' : 'text-paper/70 hover:bg-white/5 hover:text-paper')}>{label}</NavLink>
          ))}
        </nav>
      </PageBand>
      <div className="container-x py-8 sm:py-10"><Outlet /></div>
    </>
  );
}

const adminLinks = [['/admin', 'Overview', LayoutDashboard, true], ['/admin/orders', 'Job pipeline', ClipboardList], ['/admin/users', 'Users', Users], ['/admin/catalogue', 'Catalogue', Boxes], ['/admin/reports', 'Reports', BarChart3]];
export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const Side = (
    <div className="on-dark flex h-full flex-col bg-ink-900 p-4 text-paper">
      <div className="flex items-center justify-between px-2 pb-6 pt-2"><Brand to="/admin" /><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close"><X /></button></div>
      <span className="kicker kicker-dark mb-3 px-3">Production console</span>
      <nav className="flex flex-col gap-1">
        {adminLinks.map(([to, label, Icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-sm font-medium transition', isActive ? 'bg-copper-500 text-white shadow-glow' : 'text-paper/70 hover:bg-white/5 hover:text-paper')}>
            <Icon size={17} />{label}<ChevronRight size={14} className="ml-auto opacity-0 transition group-hover:opacity-60" />
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-paper/60 hover:bg-white/5"><Home size={16} />Back to website</Link>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sage-600 font-display text-sm font-bold">{user?.name?.[0]}</span>
          <div className="min-w-0 flex-1 text-xs"><div className="truncate font-semibold">{user?.name}</div><div className="truncate text-paper/50">{user?.email}</div></div>
          <button onClick={logout} title="Log out" className="text-paper/60 hover:text-white"><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[250px_1fr]">
      <ScrollManager />
      <aside className="sticky top-0 hidden h-screen lg:block">{Side}</aside>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink-900 px-4 py-3 lg:hidden on-dark"><Brand to="/admin" /><button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-paper" aria-label="Menu"><Menu size={18} /></button></div>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-ink-950/70" onClick={() => setOpen(false)} /><motion.div initial={{ x: -280 }} animate={{ x: 0 }} className="absolute left-0 top-0 h-full w-72">{Side}</motion.div></div>}
      <main className="min-w-0 p-4 sm:p-6 lg:p-8"><Suspense fallback={<PageLoader />}><PageTransition><Outlet /></PageTransition></Suspense></main>
    </div>
  );
}
