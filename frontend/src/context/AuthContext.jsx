import { createContext, useCallback, useContext, useState } from 'react';

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [providerLoggedIn, setProviderLoggedIn] = useState(false);
  const [providerProfile, setProviderProfile] = useState(null);

  const loginAsProvider = useCallback((profile = null) => {
    setProviderLoggedIn(true);
    setProviderProfile(
      profile || {
        name: 'Demo Provider',
        service: 'Electrician',
        sector: 'G-13',
      },
    );
  }, []);

  const logout = useCallback(() => {
    setProviderLoggedIn(false);
    setProviderProfile(null);
  }, []);

  return (
    <AuthCtx.Provider
      value={{ providerLoggedIn, providerProfile, loginAsProvider, logout }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
