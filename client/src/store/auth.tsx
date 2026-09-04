import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import type { User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (data: { name: string; email?: string; mobile?: string; password: string; company?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      disconnectSocket();
    });
    refresh();
  }, [refresh]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isStaff: !!user && (user.role === 'agent' || user.role === 'admin'),
      isAdmin: user?.role === 'admin',
      setUser,
      refresh,
      login: async (identifier, password) => {
        const r = await api.post('/auth/login', { identifier, password });
        setUser(r.user);
        return r.user;
      },
      register: async (data) => {
        const r = await api.post('/auth/register', data);
        setUser(r.user);
        return r.user;
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        disconnectSocket();
        setUser(null);
      },
    }),
    [user, loading, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
