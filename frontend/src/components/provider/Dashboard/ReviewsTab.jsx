import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { fetchProviderReviews } from '../../../api/provider';
import styles from './ReviewsTab.module.css';

function StarDisplay({ rating }) {
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          className={`${styles.starSvg} ${i <= rating ? styles.starFilled : styles.starEmpty}`}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({ review }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.review_text && review.review_text.length > 200;

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-PK', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.reviewCard}>
      <div className={styles.cardTop}>
        <div className={styles.customerAvatar}>
          {review.customer_name?.[0]?.toUpperCase() || 'C'}
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.customerName}>{review.customer_name}</span>
          <div className={styles.cardMetaRow}>
            <StarDisplay rating={review.rating} />
            <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
          </div>
        </div>
        <div className={styles.ratingBadge}>
          {review.rating}/5
        </div>
      </div>

      {review.review_text ? (
        <div className={styles.reviewTextWrap}>
          <p className={`${styles.reviewText} ${isLong && !expanded ? styles.reviewTextClamped : ''}`}>
            {review.review_text}
          </p>
          {isLong && (
            <button className={styles.expandBtn} onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Kam dikhao ↑' : 'Zyada dikhao ↓'}
            </button>
          )}
        </div>
      ) : (
        <p className={styles.noReviewText}>Sirf rating di gai thi, koi review nahi.</p>
      )}
    </div>
  );
}

export default function ReviewsTab() {
  const { providerProfile } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (pageNum, append = false) => {
    if (!providerProfile?.id) return;
    try {
      const data = await fetchProviderReviews(providerProfile.id, pageNum);
      setReviews(prev => append ? [...prev, ...data.reviews] : data.reviews);
      setTotalCount(data.total_count);
      setHasMore(data.has_more);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }, [providerProfile?.id]);

  useEffect(() => {
    setLoading(true);
    loadPage(1, false).finally(() => setLoading(false));
  }, [loadPage]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await loadPage(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  // Compute average from loaded reviews for header (backend already has per-provider rolling avg but let's show count)
  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h1 className={styles.tabTitle}>Customer Reviews</h1>
        <p className={styles.tabSubtitle}>
          {!loading && totalCount > 0
            ? `${totalCount} customer ne apna tajurba share kiya`
            : 'Aapke kaam ke baare mein customers ki raaye'}
        </p>
      </div>

      {loading ? (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeleton}>
              <div className={styles.skeletonTop} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>Abhi koi review nahi hai</h3>
          <p className={styles.emptySubtitle}>
            Kaam mein excellence dikhao — customers khud hi acha review denge!
          </p>
        </div>
      ) : (
        <div className={styles.reviewGrid}>
          {reviews.map((review, idx) => (
            <ReviewCard key={idx} review={review} />
          ))}

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
              ) : `Aur dekhein (${totalCount - reviews.length} baki)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
