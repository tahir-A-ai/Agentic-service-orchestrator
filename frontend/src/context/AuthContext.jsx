import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { loginApi, signupApi, logoutApi, getMeApi } from '../api/auth';
import { useToast } from './ToastContext';

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Provides authentication state, user actions, provider information, and authentication modal controls to descendant components.
 * @param {Object} props - Provider properties.
 * @param {React.ReactNode} props.children - Components that consume the authentication context.
 */
export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('karigar_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // If token expiration timestamp has passed, immediately clear stale session
      if (
        typeof parsed.expiresAt !== 'number' ||
        Date.now() >= parsed.expiresAt
      ) {
        localStorage.removeItem('karigar_user');
        return null;
      }
      return parsed;
    } catch { return null; }
  });

  // Verify session on mount and handle token expiration lifecycle
  useEffect(() => {
    let isMounted = true;

    // 1. If user is stored, verify with server /auth/me
    if (user) {
      getMeApi()
        .then((meData) => {
          if (!isMounted) return;
          setUser((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              full_name: meData.full_name ?? prev.full_name,
              role: meData.role ?? prev.role,
              providerId: meData.provider_id ?? prev.providerId,
              service_type: meData.service_type ?? prev.service_type,
              location: meData.location ?? prev.location,
              phone: meData.phone ?? prev.phone,
              bio: meData.bio ?? prev.bio,
              photo_url: meData.photo_url ?? prev.photo_url,
            };
            localStorage.setItem('karigar_user', JSON.stringify(updated));
            return updated;
          });
        })
        .catch((err) => {
          if (!isMounted) return;
          if (err?.status === 401) {
            localStorage.removeItem('karigar_user');
            setUser(null);
          }
        });
    }

    // 2. Set timer for remaining token lifetime
    let timer = null;
    if (user?.expiresAt) {
      const msRemaining = user.expiresAt - Date.now();
      if (msRemaining <= 0) {
        localStorage.removeItem('karigar_user');
        setUser(null);
      } else {
        timer = setTimeout(() => {
          localStorage.removeItem('karigar_user');
          setUser(null);
          showToast('Session expire ho gaya. Dobara login karein.', 'info');
        }, msRemaining);
      }
    }

    // 3. Listen for 401 unauthorized events from any API call
    const handleUnauthorized = () => {
      localStorage.removeItem('karigar_user');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [user?.expiresAt, showToast]);

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

      const expiresAt = Date.now() + (data.expires_in || 86400) * 1000;
      const payload = {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        providerId: data.provider_id,
        service_type: data.service_type,
        location: data.location,
        phone: data.phone,
        bio: data.bio,
        photo_url: data.photo_url,
        expiresAt,
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
