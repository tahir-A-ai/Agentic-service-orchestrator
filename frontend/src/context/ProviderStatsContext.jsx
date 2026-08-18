import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ProviderStatsCtx = createContext(null);

export function useProviderStats() {
  const ctx = useContext(ProviderStatsCtx);
  if (!ctx) throw new Error('useProviderStats must be used inside ProviderStatsProvider');
  return ctx;
}

/**
 * Owns a single persistent WebSocket connection to /api/v1/stream/provider/{id}.
 * The backend pushes:
 *   - stats_update  — on connect and on booking events (badge counter)
 *   - job_cancelled — when a customer cancels a confirmed job (triggers modal)
 * Provides: { stats, loading, cancellationEvent, clearCancellationEvent, jobsRefetchKey }
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
  // Holds the job_cancelled payload when a customer cancels; null = no modal
  const [cancellationEvent, setCancellationEvent] = useState(null);
  // Incremented each time a job_cancelled arrives so dependent components can refetch
  const [jobsRefetchKey, setJobsRefetchKey] = useState(0);

  const clearCancellationEvent = useCallback(() => setCancellationEvent(null), []);

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
        } else if (data.type === 'job_cancelled') {
          // Show the cancellation modal and trigger a jobs list refresh
          setCancellationEvent({ sessionId: data.session_id, cancelledBy: data.cancelled_by });
          setJobsRefetchKey(k => k + 1);
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      setLoading(false);
    };

    return () => ws.close();
  }, [providerProfile?.id]);

  return (
    <ProviderStatsCtx.Provider value={{
      stats,
      loading,
      cancellationEvent,
      clearCancellationEvent,
      jobsRefetchKey,
    }}>
      {children}
    </ProviderStatsCtx.Provider>
  );
}
