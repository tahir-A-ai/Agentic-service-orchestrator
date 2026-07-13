import styles from './EmptyState.module.css';

/**
 * Empty state placeholder for lists/tabs with no data.
 *
 * @param {string} icon — emoji or icon text
 * @param {string} title — primary message
 * @param {string} subtitle — secondary hint
 */
export default function EmptyState({
  title = 'Kuch nahi mila',
  subtitle,
  children,
}) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.illustration}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="50" fill="var(--bg-tertiary)" />
          <path d="M40 70C40 70 48 85 60 85C72 85 80 70 80 70" stroke="var(--border-subtle)" strokeWidth="6" strokeLinecap="round" />
          <path d="M45 50L55 60M55 50L45 60" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" />
          <path d="M65 50L75 60M75 50L65 60" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className={styles.title}>{title}</h3>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
