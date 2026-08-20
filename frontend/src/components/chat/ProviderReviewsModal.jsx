import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchProviderReviews } from '../../api/provider';
import styles from './ProviderReviewsModal.module.css';

/**
 * Display a paginated list of reviews for a provider in a modal dialog.
 *
 * @param {number} providerId - Identifier of the provider whose reviews are displayed.
 * @param {string} providerName - Provider name shown in the modal header.
 * @param {number} providerRating - Average provider rating shown in the modal header.
 * @param {Function} onClose - Callback invoked when the modal is closed.
 * @returns {JSX.Element} The provider reviews modal.
 */
export default function ProviderReviewsModal({ providerId, providerName, providerRating, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  const loadPage = useCallback(async (pageNum, append = false) => {
    try {
      if (!append) setError(null);
      const data = await fetchProviderReviews(providerId, pageNum);
      setReviews(prev => append ? [...prev, ...data.reviews] : data.reviews);
      setTotalCount(data.total_count);
      setHasMore(data.has_more);
      return true;
    } catch (err) {
      console.error('Failed to load reviews:', err);
      if (!append) {
        setError('Reviews load nahi ho sakay. Internet connection check karein.');
      }
      return false;
    }
  }, [providerId]);

  const handleInitialRetry = () => {
    setLoading(true);
    setError(null);
    loadPage(1, false).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPage(1, false).finally(() => setLoading(false));
  }, [loadPage]);

  // Focus trap, Escape key close, and focus restoration
  useEffect(() => {
    previousActiveElement.current = document.activeElement;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalRef.current?.querySelectorAll(focusableSelector);
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalRef.current?.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(modalRef.current.querySelectorAll(focusableSelector)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

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
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [onClose]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const success = await loadPage(nextPage, true);
      if (success) {
        setPage(nextPage);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleExpand = (idx) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const renderStars = (count) => (
    <span className={styles.stars} aria-label={`${count} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          className={`${styles.starSvg} ${i <= count ? styles.starFilled : styles.starEmpty}`}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviews-modal-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 id="reviews-modal-title" className={styles.title}>{providerName}</h2>
            <div className={styles.headerMeta}>
              <span className={styles.avgRating}>
                <svg width="16" height="16" viewBox="0 0 24 24" className={styles.avgStarSvg}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {providerRating?.toFixed(1) ?? '—'}
              </span>
              {!loading && <span className={styles.countBadge}>{totalCount} Review{totalCount !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close reviews">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.skeletonList}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skeleton}>
                  <div className={styles.skeletonTop} />
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.errorIcon}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className={styles.errorTitle}>Reviews load nahi ho sakay</p>
              <p className={styles.errorSubtitle}>{error}</p>
              <button className={styles.retryBtn} onClick={handleInitialRetry}>
                Dobara Try Karein
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.emptyIcon}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p className={styles.emptyTitle}>Abhi koi review nahi hai</p>
              <p className={styles.emptySubtitle}>Yeh provider ka pehla customer ban kar review karein!</p>
            </div>
          ) : (
            <div className={styles.reviewList}>
              {reviews.map((review, idx) => {
                const isLong = review.review_text && review.review_text.length > 160;
                const isExpanded = expandedIds.has(idx);
                return (
                  <div key={idx} className={styles.reviewCard}>
                    <div className={styles.reviewTop}>
                      <div className={styles.customerInitial}>{review.customer_name?.[0]?.toUpperCase() || 'C'}</div>
                      <div className={styles.reviewMeta}>
                        <span className={styles.customerName}>{review.customer_name}</span>
                        <div className={styles.reviewMetaRow}>
                          {renderStars(review.rating)}
                          <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {review.review_text && (
                      <div className={styles.reviewTextWrap}>
                        <p className={`${styles.reviewText} ${isLong && !isExpanded ? styles.reviewTextClamped : ''}`}>
                          {review.review_text}
                        </p>
                        {isLong && (
                          <button className={styles.expandBtn} onClick={() => toggleExpand(idx)}>
                            {isExpanded ? 'Kam dikhao' : 'Zyada dikhao'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <button
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <span className={styles.loadingInner}>
                      <span className={styles.spinner} />
                      Load ho raha hai...
                    </span>
                  ) : `Aur reviews dekhein (${totalCount - reviews.length} baki)`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
