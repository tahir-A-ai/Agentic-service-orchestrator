import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { loginApi, signupApi, logoutApi, getMeApi, refreshApi } from '../api/auth';
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

    // 2. Set timer to silently refresh access token before it expires
    let timer = null;
    if (user?.expiresAt) {
      const msRemaining = user.expiresAt - Date.now();
      if (msRemaining <= 0) {
        // Token already expired — attempt silent refresh immediately
        refreshApi()
          .then(({ expires_in }) => {
            if (!isMounted) return;
            setUser(prev => {
              if (!prev) return null;
              const updated = { ...prev, expiresAt: Date.now() + expires_in * 1000 };
              localStorage.setItem('karigar_user', JSON.stringify(updated));
              return updated;
            });
          })
          .catch(() => {
            if (!isMounted) return;
            localStorage.removeItem('karigar_user');
            setUser(null);
            showToast('Session expire ho gaya. Dobara login karein.', 'info');
          });
      } else {
        // Refresh 30 seconds before expiry so there's no gap
        const refreshIn = Math.max(0, msRemaining - 30_000);
        timer = setTimeout(async () => {
          try {
            const { expires_in } = await refreshApi();
            if (!isMounted) return;
            setUser(prev => {
              if (!prev) return null;
              const updated = { ...prev, expiresAt: Date.now() + expires_in * 1000 };
              localStorage.setItem('karigar_user', JSON.stringify(updated));
              return updated;
            });
          } catch {
            if (!isMounted) return;
            localStorage.removeItem('karigar_user');
            setUser(null);
            showToast('Session expire ho gaya. Dobara login karein.', 'info');
          }
        }, refreshIn);
      }
    }

    // 3. Listen for 401 unauthorized events (refresh itself failed — force logout)
    const handleUnauthorized = () => {
      localStorage.removeItem('karigar_user');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    // 4. Listen for token_refreshed events dispatched by core.js interceptor
    //    so the AuthContext expiresAt stays in sync with what the server issued
    const handleTokenRefreshed = (e) => {
      if (!isMounted) return;
      const { expiresAt } = e.detail || {};
      if (!expiresAt) return;
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, expiresAt };
        localStorage.setItem('karigar_user', JSON.stringify(updated));
        return updated;
      });
    };
    window.addEventListener('auth:token_refreshed', handleTokenRefreshed);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
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
