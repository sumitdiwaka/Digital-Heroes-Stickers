import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountLayout, AdminLayout, PublicLayout, RequireAuth } from './components/layout/Layouts';
import { PageLoader, SheetLoader } from './components/ui';

const Home = lazy(() => import('./pages/Home'));
const Catalogue = lazy(() => import('./pages/Catalogue'));
const Division = lazy(() => import('./pages/Division'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Dashboard = lazy(() => import('./pages/customer/Dashboard'));
const Orders = lazy(() => import('./pages/customer/Orders'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail'));
const Designs = lazy(() => import('./pages/customer/Designs'));
const Profile = lazy(() => import('./pages/customer/Profile'));
const Checkout = lazy(() => import('./pages/customer/Checkout'));
const Designer = lazy(() => import('./pages/designer/Designer'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCatalogue = lazy(() => import('./pages/admin/AdminCatalogue'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

/** One-time 3D splash on first visit of a session */
function Splash() {
  const [show, setShow] = useState(() => { try { return !sessionStorage.getItem('dh_splash'); } catch { return false; } });
  useEffect(() => {
    if (!show) return undefined;
    const t = setTimeout(() => { setShow(false); try { sessionStorage.setItem('dh_splash', '1'); } catch { /* ignore */ } }, 1500);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[200] grid place-items-center bg-ink-900" exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: .5 }}>
          <div className="grid-lines absolute inset-0" aria-hidden />
          <div className="relative"><SheetLoader label="Setting the press" /></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <>
      <Splash />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Catalogue />} />
            <Route path="/division/:slug" element={<Division />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/gallery" element={<Gallery />} />
            {['login', 'register', 'forgot-password', 'reset-password'].map((p) => <Route key={p} path={`/${p}`} element={<Auth mode={p} />} />)}
            <Route element={<RequireAuth><AccountLayout /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/checkout/:id" element={<Checkout />} />
              <Route path="/designs" element={<Designs />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/designer/:slug" element={<RequireAuth><Designer /></RequireAuth>} />
          <Route element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/catalogue" element={<AdminCatalogue />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
