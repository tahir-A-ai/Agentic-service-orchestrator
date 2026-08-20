import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import TrackingHeader from '../components/booking/TrackingHeader';
import LiveProviderCard from '../components/booking/LiveProviderCard';
import RatingModal from '../components/booking/RatingModal';
import { useToast } from '../context/ToastContext';
import { cancelBooking } from '../api/booking';
import styles from './ConfirmedPage.module.css';

export default function ConfirmedPage() {
  const { confirmed, setConfirmed, reset, lastUserPrompt, addExcludedId } = useChat();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState('Pending_Acceptance');
  const [liveProvider, setLiveProvider] = useState(
    confirmed?.booked?.[0] || null
  );
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const isNavigatingRef = useRef(false);
  const hasCancelledRef = useRef(false);          // ← guard: prevents duplicate cancel handling
  const showRatingModalRef = useRef(showRatingModal);
  const liveProviderRef = useRef(liveProvider);   // ← always up-to-date without being a dep
  const timeoutsRef = useRef([]);

  useEffect(() => {
    showRatingModalRef.current = showRatingModal;
  }, [showRatingModal]);

  // Keep liveProviderRef in sync with state (does NOT re-run the WS effect)
  useEffect(() => {
    liveProviderRef.current = liveProvider;
  }, [liveProvider]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Initialize and redirect check
  useEffect(() => {
    if (!confirmed && !isNavigatingRef.current) {
      navigate('/chat', { replace: true });
    } else if (confirmed?.booked && confirmed.booked.length > 0) {
      setLiveProvider(confirmed.booked[0]);
    }
  }, [confirmed, navigate]);

  // WebSocket Connection — only depends on session_id (stable value)
  // liveProvider is accessed via liveProviderRef to avoid reconnect loop
  useEffect(() => {
    if (!confirmed?.session_id) return;

    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const wsBase = apiBase.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/v1/stream/booking/${confirmed.session_id}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status_update') {
          setStatus(data.status);

          setLiveProvider(prev => ({
            ...prev,
            ...(data.provider_name && { name: data.provider_name }),
            ...(data.service_type && { service_type: data.service_type })
          }));

          if (data.status === 'Pending_Completion') {
            setShowRatingModal(true);
          } else if (data.status === 'Completed') {
            if (!showRatingModalRef.current && !isNavigatingRef.current) {
              isNavigatingRef.current = true;
              showToast('Yeh booking complete ho chuki hai.', 'info');
              setConfirmed(null);
              navigate('/chat', { state: { jobCompleted: true }, replace: true });
            }
          } else if (data.status === 'Cancelled') {

            // Guard: only handle cancellation once, no matter how many WS messages arrive
            if (hasCancelledRef.current || isNavigatingRef.current) return;
            hasCancelledRef.current = true;
            isNavigatingRef.current = true;

            if (data.cancelled_by !== 'customer') {
              showToast('Provider ne request cancel kar di. Doosra provider dhoond rahe hain...', 'info');
              const t = setTimeout(() => {
                // Read provider info from ref (avoids stale closure)
                const currentProvider = liveProviderRef.current;
                const providerId = data.provider_id || currentProvider?.id || confirmed?.booked?.[0]?.id;
                const providerName = data.provider_name || currentProvider?.name || 'Provider';
                if (providerId) {
                  addExcludedId(providerId);
                }
                setConfirmed(null);
                navigate('/chat', {
                  state: {
                    providerCancelled: true,
                    providerName,
                    providerId,
                    autoFetch: lastUserPrompt,
                  },
                  replace: true,
                });
              }, 2000);
              timeoutsRef.current.push(t);
            } else {
              showToast('Yeh booking cancel ho chuki hai.', 'info');
              setConfirmed(null);
              navigate('/chat', { state: { customerCancelled: true }, replace: true });
            }
          }
        }
      } catch (err) {
        console.error("WebSocket message parse error", err);
      }
    };

    return () => {
      ws.close();
    };
  // ← liveProvider intentionally EXCLUDED to prevent reconnect loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed?.session_id]);


  if (!confirmed || !liveProvider) return null;

  const handleNewBooking = () => {
    isNavigatingRef.current = true;
    reset();
    navigate('/chat', { replace: true });
  };

  const handleCancelRequest = async () => {
    if (!window.confirm("Are you sure you want to cancel this request?")) return;
    
    setIsCancelling(true);
    isNavigatingRef.current = true;
    try {
      await cancelBooking(confirmed.session_id);
      showToast('Request cancel ho gayi. Chat par redirect ho rahe hain...', 'info');
      const t = setTimeout(() => {
        setConfirmed(null);
        navigate('/chat', { state: { customerCancelled: true }, replace: true });
      }, 1000);
      timeoutsRef.current.push(t);
    } catch (err) {
      showToast('Failed to cancel: ' + (err.message || 'Error occurred'), 'error');
      setIsCancelling(false);
      isNavigatingRef.current = false;
    }
  };


  const shortId = confirmed.session_id ? confirmed.session_id.substring(0, 8) : 'bkg-123';

  if (isCancelling) {
    return (
      <div className={styles.page}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div className={styles.spinner} style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h2>Cancelling Request...</h2>
          <p style={{ color: 'var(--text-muted)' }}>Redirecting to chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.mainCard}>
          <TrackingHeader status={status} />

          <LiveProviderCard provider={liveProvider} status={status} />

          {/* Failed Providers Warning */}
          {confirmed.failed && confirmed.failed.length > 0 && (
            <div className={styles.warningBox}>
              <span className={styles.warningIcon}>⚠</span>
              <div className={styles.warningText}>
                <strong>Kuch providers busy ho gaye.</strong>
                <p>Inke liye aap dobara try kar sakte hain.</p>
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.footerCol}>
              <span className={styles.footerLabel}>Booking ID</span>
              <span className={styles.footerValue}>{shortId}</span>
            </div>
            <div className={`${styles.footerCol} ${styles.footerColRight}`}>
              <span className={styles.footerLabel}>{status === 'Pending_Acceptance' ? 'Last Checked' : 'ETA'}</span>
              <span className={status === 'Pending_Acceptance' ? styles.footerValue : styles.footerValueGreen}>
                {status === 'Pending_Acceptance' ? 'Just now' : '30-45 min'}
              </span>
            </div>
          </div>

          <div className={styles.actionRow}>
            {status !== 'Cancelled' && status !== 'Completed' && status !== 'Pending_Completion' ? (
              <button onClick={handleCancelRequest} className={`${styles.btn} ${styles.cancelBtn}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Cancel Request
              </button>
            ) : (
              <button onClick={handleNewBooking} className={`${styles.btn} ${styles.newBookingBtn}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"></path>
                  <path d="M3 12a9 9 0 1 0 2.13-5.88L2 9"></path>
                </svg>
                Start New Booking
              </button>
            )}
          </div>
        </div>

        <RatingModal
          isOpen={showRatingModal}
          sessionId={confirmed.session_id}
          providerName={liveProvider.name}
          onComplete={() => {
            isNavigatingRef.current = true;
            setShowRatingModal(false);
            setStatus('Completed');
            showToast('Shukriya! Aapki rating submit ho gayi.', 'success');
            setTimeout(() => {
              setConfirmed(null);
              navigate('/chat', { state: { jobCompleted: true }, replace: true });
            }, 1800);
          }}
        />

      </div>
    </div>
  );
}
