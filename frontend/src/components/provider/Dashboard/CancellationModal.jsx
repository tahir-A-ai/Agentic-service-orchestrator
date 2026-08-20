import { useEffect, useRef } from 'react';
import styles from './CancellationModal.module.css';

/**
 * Display a dialog notifying the provider that a customer's job was canceled.
 * @param {string} [sessionId] - The canceled job's session identifier.
 * @param {Function} onAcknowledge - Callback invoked when the provider acknowledges the cancellation.
 * @returns {JSX.Element} The cancellation dialog.
 */
export default function CancellationModal({ sessionId, onAcknowledge }) {
  const ackBtnRef = useRef(null);
  const modalRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  useEffect(() => {
    // Save the element that had focus before the modal opened
    previouslyFocusedElementRef.current = document.activeElement;

    // Automatically shift focus to the acknowledgement button
    ackBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAcknowledge();
      } else if (e.key === 'Tab') {
        // Keep focus trapped inside the dialog
        if (!modalRef.current) return;
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous control after modal closes
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [onAcknowledge]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div className={styles.modal} ref={modalRef}>
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

        <button ref={ackBtnRef} className={styles.ackBtn} onClick={onAcknowledge}>
          Theek Hai, Samajh Gaya
        </button>
      </div>
    </div>
  );
}
