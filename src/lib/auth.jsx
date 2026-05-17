import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok) {
          setUser(data.user);
          setSubscription(data.subscription);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const safeParse = async (res) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: false, error: text || `Ошибка сервера (${res.status})` }; }
  };

  const sendCode = useCallback(async (email) => {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await safeParse(res);
    if (!data.ok) throw new Error(data.error || 'Ошибка');
    return data;
  }, []);

  const verify = useCallback(async (email, code, name, phone, extra = {}) => {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code, name, phone, ...extra }),
    });
    const data = await safeParse(res);
    if (!data.ok) throw new Error(data.error || 'Ошибка');
    setUser(data.user);
    setSubscription(data.subscription);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setSubscription(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    const res = await fetch('/api/subscription/status', { credentials: 'include' });
    const data = await res.json();
    if (data?.ok) {
      setSubscription(data.subscription);
      return data;
    }
    return null;
  }, []);

  const hasAccess = !!(subscription && (subscription.status === 'trial' || subscription.status === 'active'));

  return (
    <AuthContext.Provider value={{ user, subscription, loading, hasAccess, sendCode, verify, logout, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
