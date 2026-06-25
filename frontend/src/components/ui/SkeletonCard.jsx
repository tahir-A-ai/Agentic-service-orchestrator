import styles from './SkeletonCard.module.css';

/**
 * Animated skeleton placeholder for loading states.
 *
 * @param {number} lines — number of shimmer lines to show (default 3)
 */
export default function SkeletonCard({ lines = 3 }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={[styles.line, styles.title].join(' ')} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div
          key={i}
          className={styles.line}
          style={{ width: `${70 + Math.random() * 25}%` }}
        />
      ))}
    </div>
  );
}
