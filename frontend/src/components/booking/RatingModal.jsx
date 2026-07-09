import React, { useState } from 'react';
import { confirmCompletion } from '../../api/client';
import styles from './RatingModal.module.css';

export default function RatingModal({ isOpen, sessionId, providerName, onComplete }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      const res = await confirmCompletion(sessionId, rating);
      onComplete(res);
    } catch (err) {
      console.error('Failed to submit rating:', err);
      // In a real app, we'd show an error toast here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <svg className={styles.icon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        
        <h2 className={styles.title}>Job Completed!</h2>
        <p className={styles.subtitle}>
          {providerName} has finished the job. Please rate your experience to finalize.
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
            >
              <svg 
                width="32" height="32" viewBox="0 0 24 24"
                className={`${styles.star} ${star <= (hoveredRating || rating) ? styles.starFilled : styles.starEmpty}`}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>

        <button 
          className={styles.submitBtn} 
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit & Complete'}
        </button>
      </div>
    </div>
  );
}
