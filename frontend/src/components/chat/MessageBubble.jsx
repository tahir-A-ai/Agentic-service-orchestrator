import styles from './MessageBubble.module.css';

/**
 * Chat message bubble for user or agent messages.
 *
 * @param {'user'|'agent'} role
 * @param {React.ReactNode} children — message content
 */
export default function MessageBubble({ role, children }) {
  return (
    <div
      className={[styles.row, styles[role]].join(' ')}
    >
      {role === 'agent' && (
        <div className={styles.avatar} aria-hidden="true">
          <span className={styles.avatarMark} />
        </div>
      )}
      <div className={[styles.bubble, styles[`${role}Bubble`]].join(' ')}>
        {children}
      </div>
    </div>
  );
}
