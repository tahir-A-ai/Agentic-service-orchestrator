import { createContext, useCallback, useContext, useState } from 'react';
import { loginApi, signupApi } from '../api/client';

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('karigar_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const login = useCallback(async (username, password) => {
    const data = await loginApi(username, password);
    localStorage.setItem('karigar_token', data.access_token);
    const payload = {
      username: data.username,
      role: data.role,
      providerId: data.provider_id,
    };
    localStorage.setItem('karigar_user', JSON.stringify(payload));
    setUser(payload);
    return payload;
  }, []);

  const signup = useCallback(async (payload) => {
    return await signupApi(payload);
  }, []);

  const loginAsProvider = useCallback((profile = null) => {
    const payload = {
      username: profile?.name || 'Demo Provider',
      role: 'provider',
      providerId: null,
    };
    localStorage.setItem('karigar_user', JSON.stringify(payload));
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('karigar_token');
    localStorage.removeItem('karigar_user');
    setUser(null);
  }, []);

  const providerLoggedIn = !!(user && user.role === 'provider');
  const providerProfile = providerLoggedIn ? {
    id: user.providerId,
    name: user.username,
    service: 'Electrician',
    sector: 'G-13',
  } : null;

  // Global Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState('role-select');

  const openAuth = useCallback((view = 'role-select') => {
    setAuthModalView(view);
    setAuthModalOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  return (
    <AuthCtx.Provider value={{
      isAuthenticated: !!user,
      user,
      login,
      signup,
      loginAsProvider,
      logout,
      providerLoggedIn,
      providerProfile,
      authModalOpen,
      authModalView,
      openAuth,
      closeAuth,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}
