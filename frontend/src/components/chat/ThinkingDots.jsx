import styles from './ThinkingDots.module.css';

/** Animated three-dot typing indicator for agent thinking state. */
export default function ThinkingDots() {
  return (
    <div className={styles.wrapper} aria-label="Agent is thinking">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
