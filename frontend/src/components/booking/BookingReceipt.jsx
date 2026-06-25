import Badge from '../ui/Badge';
import styles from './BookingReceipt.module.css';

/**
 * Receipt card for a confirmed provider booking.
 *
 * @param {Object} provider
 */
export default function BookingReceipt({ provider }) {
  // Mock ETA for demo
  const eta = '30-45 mins';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.name}>{provider.name}</h3>
          <Badge variant="green">{provider.service_type || 'Service'}</Badge>
        </div>
        <div className={styles.eta}>
          <span className={styles.etaLabel}>ETA</span>
          <span className={styles.etaTime}>{eta}</span>
        </div>
      </div>

      <div className={styles.details}>
        <span className={styles.detailItem}>⭐ {provider.rating} Rating</span>
        <span className={styles.detailItem}>📌 {provider.location || 'G-13'}</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.callBtn} disabled>
          Call Provider
        </button>
        <button className={styles.mapBtn}>
          View on Map
        </button>
      </div>
    </div>
  );
}
