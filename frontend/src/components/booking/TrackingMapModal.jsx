import { useEffect } from 'react';
import LiveTrackingMap from './LiveTrackingMap';
import styles from './TrackingMapModal.module.css';

/**
 * Modal wrapper displaying the LiveTrackingMap with backdrop and transitions.
 */
export default function TrackingMapModal({
  isOpen,
  onClose,
  provider,
  customer,
  status,
  isProviderView = false,
}) {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Live Tracking Map"
    >
      <div className={styles.modal}>
        <LiveTrackingMap
          provider={provider}
          customer={customer}
          status={status}
          onClose={onClose}
          isProviderView={isProviderView}
        />
      </div>
    </div>
  );
}
