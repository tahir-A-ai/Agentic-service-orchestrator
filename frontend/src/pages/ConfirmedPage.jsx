import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import TrackingHeader from '../components/booking/TrackingHeader';
import LiveProviderCard from '../components/booking/LiveProviderCard';
import RatingModal from '../components/booking/RatingModal';
import { useToast } from '../context/ToastContext';
import styles from './ConfirmedPage.module.css';

export default function ConfirmedPage() {
  const { confirmed, reset, lastUserPrompt, addExcludedId } = useChat();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState('Pending_Acceptance');
  const [liveProvider, setLiveProvider] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const isNavigatingRef = useRef(false);

  // Initialize and redirect check
  useEffect(() => {
    if (!confirmed && !isNavigatingRef.current) {
      navigate('/');
    } else if (confirmed?.booked && confirmed.booked.length > 0) {
      setLiveProvider(confirmed.booked[0]);
    }
  }, [confirmed, navigate]);

  // WebSocket Connection
  useEffect(() => {
    if (!confirmed?.session_id) return;

    const wsUrl = `ws://localhost:8000/api/v1/stream/booking/${confirmed.session_id}`;
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
          } else if (data.status === 'Cancelled') {
            showToast('Provider declined the request. Searching again...', 'error');
            // Show auto-redirect after a short delay so they can see the "Declined" state
            setTimeout(() => {
              isNavigatingRef.current = true;
              const providerId = data.provider_id || confirmed?.booked?.[0]?.id;
              if (providerId) {
                addExcludedId(providerId);
              }
              reset();
              navigate('/chat', { state: { autoFetch: lastUserPrompt } });
            }, 3000);
          }
        }
      } catch (err) {
        console.error("WebSocket message parse error", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [confirmed?.session_id]);

  if (!confirmed || !liveProvider) return null;

  const handleNewBooking = () => {
    isNavigatingRef.current = true;
    reset();
    navigate('/chat');
  };

  const shortId = confirmed.session_id ? confirmed.session_id.substring(0, 8) : 'bkg-123';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        
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

        <button onClick={handleNewBooking} className={styles.newBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 1 0 2.13-5.88L2 9"></path>
          </svg>
          New Booking
        </button>

        <RatingModal 
          isOpen={showRatingModal}
          sessionId={confirmed.session_id}
          providerName={liveProvider.name}
          onComplete={() => {
            setShowRatingModal(false);
            setStatus('Completed');
          }}
        />
      </div>
    </div>
  );
}
