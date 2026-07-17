import { createContext, useCallback, useContext, useState } from 'react';
import { loginApi, signupApi } from '../api/auth';
import { useToast } from './ToastContext';

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('karigar_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const login = useCallback(async (username, password) => {
    try {
      const data = await loginApi(username, password);
      localStorage.setItem('karigar_token', data.access_token);
      const payload = {
        username: data.username,
        role: data.role,
        providerId: data.provider_id,
        service_type: data.service_type,
        location: data.location,
      };
      localStorage.setItem('karigar_user', JSON.stringify(payload));
      setUser(payload);
      showToast(`Welcome back, ${data.username}!`, 'success');
      return payload;
    } catch (err) {
      showToast('Login failed. Please check your credentials.', 'error');
      throw err;
    }
  }, [showToast]);

  const signup = useCallback(async (payload) => {
    try {
      const res = await signupApi(payload);
      showToast('Account created successfully!', 'success');
      return res;
    } catch (err) {
      showToast('Signup failed. Please try again.', 'error');
      throw err;
    }
  }, [showToast]);



  const logout = useCallback(() => {
    localStorage.removeItem('karigar_token');
    localStorage.removeItem('karigar_user');
    setUser(null);
    showToast('Logged out successfully', 'info');
  }, [showToast]);

  const providerLoggedIn = !!(user && user.role === 'provider');
  const providerProfile = providerLoggedIn ? {
    id: user.providerId,
    name: user.username,
    service: user.service_type || 'Service',
    sector: user.location || 'Location',
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
