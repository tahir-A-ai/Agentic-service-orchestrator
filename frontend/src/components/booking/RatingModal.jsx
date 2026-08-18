import React, { useState } from 'react';
import { confirmCompletion } from '../../api/booking';
import styles from './RatingModal.module.css';

export default function RatingModal({ isOpen, sessionId, providerName, onComplete }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      const res = await confirmCompletion(sessionId, rating, reviewText);
      onComplete(res);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  const ratingLabels = ['', 'Bohot kharab', 'Kharab', 'Theek thak', 'Acha', 'Bohot acha!'];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Job completion rating">
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <svg className={styles.icon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        
        <h2 className={styles.title}>Kaam Complete!</h2>
        <p className={styles.subtitle}>
          <strong>{providerName}</strong> ne kaam finish kar diya hai. Apna experience rate karein.
        </p>

        <div className={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={styles.starBtn}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              disabled={isSubmitting}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <svg 
                width="36" height="36" viewBox="0 0 24 24"
                className={`${styles.star} ${star <= displayRating ? styles.starFilled : styles.starEmpty}`}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>

        {displayRating > 0 && (
          <p className={styles.ratingLabel}>{ratingLabels[displayRating]}</p>
        )}

        {/* Optional written review textarea */}
        <div className={styles.reviewSection}>
          <label className={styles.reviewLabel} htmlFor="review-text">
            Review likhein <span className={styles.optionalBadge}>Optional</span>
          </label>
          <textarea
            id="review-text"
            className={styles.reviewTextarea}
            placeholder="Apna tajurba share karein... jaise: kaam acha kiya, waqt par aaya, professional tha..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            maxLength={1000}
            rows={4}
            disabled={isSubmitting}
          />
          {reviewText.length > 0 && (
            <span className={styles.charCount}>{reviewText.length}/1000</span>
          )}
        </div>

        <button 
          className={styles.submitBtn} 
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <span className={styles.submittingInner}>
              <span className={styles.spinnerBtn} />
              Submit ho raha hai...
            </span>
          ) : 'Submit & Complete'}
        </button>
      </div>
    </div>
  );
}
