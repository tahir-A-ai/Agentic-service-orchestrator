import styles from './Badge.module.css';

/**
 * Badge / chip component.
 *
 * @param {'green'|'blue'|'orange'|'red'|'gold'|'muted'} variant
 */
export default function Badge({ variant = 'green', children, className = '' }) {
  return (
    <span
      className={[styles.badge, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
