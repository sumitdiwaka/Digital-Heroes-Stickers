// Test harness: mounts the real <App/> inside a MemoryRouter (used by scripts/ui-test.mjs)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { setToken } from '../src/lib/api';

export { setToken };
export function mount(container, url) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 0, refetchOnWindowFocus: false } } });
  let loc = { pathname: url, search: '' };
  const Spy = () => { loc = useLocation(); return null; };
  const root = createRoot(container);
  root.render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[url]}><AuthProvider><ToastProvider><Spy /><App /></ToastProvider></AuthProvider></MemoryRouter></QueryClientProvider>);
  return { root, qc, path: () => loc.pathname + loc.search };
}
