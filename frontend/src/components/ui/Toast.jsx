import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

/**
 * Single toast notification.
 *
 * @param {'success'|'error'|'warning'} variant
 * @param {string} message
 * @param {function} onDismiss
 * @param {number} duration — auto-dismiss ms (default 4000)
 */
export default function Toast({
  variant = 'success',
  message,
  onDismiss,
  duration = 4000,
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    let unmountTimer;
    if (exiting) {
      unmountTimer = setTimeout(() => {
        onDismiss?.();
      }, 300); // 250ms animation + 50ms buffer
    }
    return () => clearTimeout(unmountTimer);
  }, [exiting, onDismiss]);

  const handleAnimationEnd = () => {
    if (exiting) onDismiss?.();
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
  };

  return (
    <div
      className={[
        styles.toast,
        styles[variant],
        exiting ? styles.exiting : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
      onAnimationEnd={handleAnimationEnd}
    >
      <span className={styles.icon}>{icons[variant]}</span>
      <span className={styles.message}>{message}</span>
      <button
        className={styles.close}
        onClick={() => setExiting(true)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Toast container — renders a stack of toasts in top-right.
 * Used by ToastContext.
 */
export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          message={t.message}
          duration={t.duration}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}
