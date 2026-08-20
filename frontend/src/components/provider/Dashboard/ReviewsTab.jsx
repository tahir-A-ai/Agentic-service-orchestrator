import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchProviderReviews } from '../../../api/provider';
import Pagination from '../../ui/Pagination';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPage = useCallback(async (pageNum) => {
    if (!providerProfile?.id) return false;
    try {
      setError(null);
      const data = await fetchProviderReviews(providerProfile.id, pageNum);
      setReviews(data.reviews || []);
      setTotalCount(data.total_count || 0);
      return true;
    } catch (err) {
      console.error('Failed to load reviews:', err);
      setError('Reviews load nahi ho sakay. Dobara koshish karein.');
      return false;
    }
  }, [providerProfile?.id]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPage(page).finally(() => setLoading(false));
  }, [loadPage, page]);

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage <= 1) {
        next.delete('page');
      } else {
        next.set('page', String(newPage));
      }
      return next;
    }, { replace: true });
  };

  const handleInitialRetry = () => {
    setLoading(true);
    setError(null);
    loadPage(page).finally(() => setLoading(false));
  };


  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h1 className={styles.tabTitle}>Customer Reviews</h1>
        <p className={styles.tabSubtitle}>
          {!loading && !error && totalCount > 0
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
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.errorIconWrap}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>Reviews load nahi ho sakay</h3>
          <p className={styles.emptySubtitle}>
            {error}
          </p>
          <button className={styles.retryBtn} onClick={handleInitialRetry}>
            Dobara Try Karein
          </button>
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
        <>
          <div className={styles.reviewGrid}>
            {reviews.map((review, idx) => (
              <ReviewCard key={review.id || idx} review={review} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalItems={totalCount}
            pageSize={10}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        </>
      )}
    </div>
  );
}

