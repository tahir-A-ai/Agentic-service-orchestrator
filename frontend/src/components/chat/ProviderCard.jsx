import { useState } from 'react';
import Badge from '../ui/Badge';
import ProviderReviewsModal from './ProviderReviewsModal';
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
  const [showReviews, setShowReviews] = useState(false);
  const formattedRating = provider.rating != null && !isNaN(Number(provider.rating))
    ? Number(provider.rating).toFixed(1)
    : '—';

  return (
    <>
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
        aria-label={`${provider.name}, ${serviceType}, rating ${formattedRating}`}
      >
        {selected && <span className={styles.check}>✓</span>}

        <div className={styles.header}>
          <span className={styles.name}>{provider.name}</span>
          <Badge variant="green">{serviceType}</Badge>
        </div>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span className={styles.star}>⭐</span> {formattedRating}
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
            className={styles.reviewsBtn}
            onClick={(e) => {
              e.stopPropagation();
              setShowReviews(true);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={styles.reviewsIcon}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Recent Reviews
          </button>
        </div>
      </div>

      {showReviews && (
        <ProviderReviewsModal
          providerId={provider.id}
          providerName={provider.name}
          providerRating={provider.rating}
          onClose={() => setShowReviews(false)}
        />
      )}
    </>
  );
}
