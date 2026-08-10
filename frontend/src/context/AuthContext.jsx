import { createContext, useCallback, useContext, useState } from 'react';
import { loginApi, signupApi, logoutApi } from '../api/auth';
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

  const login = useCallback(async (email, password, expectedRole) => {
    try {
      const data = await loginApi(email, password);
      
      // Enforce expected role if provided
      if (expectedRole) {
        const serverRole = data.role === 'customer' ? 'user' : data.role;
        if (serverRole !== expectedRole) {
          if (data.role === 'provider') {
            throw new Error('Aap as a provider registered hain, Provider tab se login karein.');
          } else {
            throw new Error('Aap as a customer registered hain, User tab se login karein.');
          }
        }
      }

      const payload = {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        providerId: data.provider_id,
        service_type: data.service_type,
        location: data.location,
        phone: data.phone,
        bio: data.bio,
        photo_url: data.photo_url
      };
      localStorage.setItem('karigar_user', JSON.stringify(payload));
      setUser(payload);
      showToast(`Welcome back, ${data.full_name || data.email}!`, 'success');
      return payload;
    } catch (err) {
      if (err.message && err.message.includes('registered hain')) {
        showToast(err.message, 'error');
        throw err;
      }
      showToast('Login failed. Please check your credentials.', 'error');
      throw err;
    }
  }, [showToast]);

  const signup = useCallback(async (payload) => {
    const res = await signupApi(payload);
    showToast('Account created successfully!', 'success');
    return res;
  }, [showToast]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.error('Logout API failed', e);
    }
    localStorage.removeItem('karigar_user');
    setUser(null);
    showToast('Logged out successfully', 'info');
  }, [showToast]);

  const updateUser = useCallback((newData) => {
    setUser(prev => {
      const updated = { ...prev, ...newData };
      localStorage.setItem('karigar_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

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

  const providerLoggedIn = !!(user && user.role === 'provider');
  const providerProfile = providerLoggedIn ? {
    id: user.providerId,
    name: user.full_name,
    sector: user.location,
    email: user.email,
    phone: user.phone,
    bio: user.bio,
    photo_url: user.photo_url,
  } : null;

  return (
    <AuthCtx.Provider value={{
      isAuthenticated: !!user,
      user,
      login,
      signup,
      logout,
      updateUser,
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
