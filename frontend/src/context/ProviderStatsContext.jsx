import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ProviderStatsCtx = createContext(null);

export function useProviderStats() {
  const ctx = useContext(ProviderStatsCtx);
  if (!ctx) throw new Error('useProviderStats must be used inside ProviderStatsProvider');
  return ctx;
}

/**
 * Owns a single persistent WebSocket connection to /api/v1/stream/provider/{id}.
 * The backend pushes a stats_update message on connect and again on every
 * booking event — no polling needed.
 * Provides: { stats, loading }
 */
export function ProviderStatsProvider({ children }) {
  const { providerProfile } = useAuth();
  const [stats, setStats] = useState({
    active_jobs: 0,
    completed_jobs: 0,
    declined_jobs: 0,
    rating: 0.0,
    service_type: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerProfile?.id) {
      setLoading(false);
      return;
    }

    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];

    const wsUrl = `ws://localhost:8000/api/v1/stream/provider/${providerProfile.id}${token ? `?token=${token}` : ''}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'stats_update') {
          setStats({
            active_jobs: data.active_jobs ?? 0,
            completed_jobs: data.completed_jobs ?? 0,
            declined_jobs: data.declined_jobs ?? 0,
            rating: data.rating ?? 0.0,
            service_type: data.service_type ?? null,
          });
          setLoading(false);
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      setLoading(false); // dashboard still renders, just without live updates
    };

    return () => ws.close();
  }, [providerProfile?.id]);

  return (
    <ProviderStatsCtx.Provider value={{ stats, loading }}>
      {children}
    </ProviderStatsCtx.Provider>
  );
}
