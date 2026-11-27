import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from '../lib/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/api/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  // any 401 from the API -> drop the session
  useEffect(() => {
    const h = () => { setToken(null); setUser(null); qc.clear(); };
    window.addEventListener('dh:unauthorized', h);
    return () => window.removeEventListener('dh:unauthorized', h);
  }, [qc]);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/api/auth/login', { email, password });
    setToken(d.token); qc.clear(); setUser(d.user); return d.user;
  }, [qc]);
  const register = useCallback(async (payload) => {
    const d = await api.post('/api/auth/register', payload);
    setToken(d.token); qc.clear(); setUser(d.user); return d.user;
  }, [qc]);
  const logout = useCallback(() => { setToken(null); setUser(null); qc.clear(); }, [qc]);
  const refresh = useCallback(() => api.get('/api/auth/me').then((d) => setUser(d.user)), []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh, isAdmin: user?.role === 'admin' }), [user, loading, login, register, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
