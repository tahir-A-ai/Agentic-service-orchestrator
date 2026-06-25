import Badge from '../ui/Badge';
import styles from './ProviderCard.module.css';

/**
 * Provider candidate card shown in chat after Phase 1.
 *
 * @param {{ id, name, rating, distance_km, location, status }} provider
 * @param {string} serviceType
 * @param {boolean} selected
 * @param {function} onToggle
 */
export default function ProviderCard({
  provider,
  serviceType,
  selected = false,
  onToggle,
}) {
  return (
    <div
      className={[styles.card, selected ? styles.selected : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={() => onToggle?.(provider.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle?.(provider.id);
        }
      }}
      aria-pressed={selected}
      aria-label={`${provider.name}, ${serviceType}, rating ${provider.rating}`}
    >
      {selected && <span className={styles.check}>✓</span>}

      <div className={styles.header}>
        <span className={styles.name}>{provider.name}</span>
        <Badge variant="green">{serviceType}</Badge>
      </div>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <span className={styles.star}>⭐</span> {provider.rating}
        </span>
        <span className={styles.metaItem}>
          📍 {provider.distance_km} km
        </span>
        <span className={styles.metaItem}>
          📌 {provider.location}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          className={[styles.approveBtn, selected ? styles.approvedBtn : ''].filter(Boolean).join(' ')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(provider.id);
          }}
        >
          {selected ? '✓ Approved' : 'Approve'}
        </button>
        <button
          className={styles.skipBtn}
          onClick={(e) => {
            e.stopPropagation();
            if (selected) onToggle?.(provider.id);
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
