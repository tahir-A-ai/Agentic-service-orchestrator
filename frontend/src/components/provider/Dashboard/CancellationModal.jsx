import styles from './CancellationModal.module.css';

/**
 * Modal shown to the provider when the customer cancels a job in real-time.
 * Triggered by a job_cancelled WebSocket event on the provider's persistent stream.
 */
export default function CancellationModal({ sessionId, onAcknowledge }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div className={styles.modal}>
        {/* Icon */}
        <div className={styles.iconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h2 id="cancel-modal-title" className={styles.title}>Job Cancel Ho Gaya</h2>
        <p className={styles.body}>
          Customer ne yeh booking cancel kar di hai. Yeh job ab aapki active list se hata di gayi hai.
        </p>

        {sessionId && (
          <p className={styles.sessionId}>Session: <span>{sessionId.slice(0, 8)}…</span></p>
        )}

        <button className={styles.ackBtn} onClick={onAcknowledge}>
          Theek Hai, Samajh Gaya
        </button>
      </div>
    </div>
  );
}
