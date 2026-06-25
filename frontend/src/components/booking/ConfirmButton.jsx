import styles from './ConfirmButton.module.css';

/**
 * Sticky bottom button for confirming booking when candidates are selected.
 *
 * @param {number} count — number of selected providers
 * @param {function} onClick
 * @param {boolean} loading
 */
export default function ConfirmButton({ count, onClick, loading }) {
  if (count === 0) return null;

  return (
    <div className={styles.wrapper}>
      <button
        className={[styles.btn, loading ? styles.loading : ''].filter(Boolean).join(' ')}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <span className={styles.spinner} />
        ) : (
          `Confirm Booking (${count} selected)`
        )}
      </button>
    </div>
  );
}
