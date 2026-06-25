import styles from './EmptyState.module.css';

/**
 * Empty state placeholder for lists/tabs with no data.
 *
 * @param {string} icon — emoji or icon text
 * @param {string} title — primary message
 * @param {string} subtitle — secondary hint
 */
export default function EmptyState({
  icon = '📭',
  title = 'Kuch nahi mila',
  subtitle,
  children,
}) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>{icon}</span>
      <h3 className={styles.title}>{title}</h3>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
