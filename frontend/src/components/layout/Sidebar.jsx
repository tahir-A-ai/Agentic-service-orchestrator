import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import styles from './Sidebar.module.css';

/**
 * Chat sidebar for history and new chat.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { reset } = useChat();
  const { user } = useAuth();

  const userName = user?.username || 'Guest User';
  const initial = userName.substring(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={[styles.overlay, isOpen ? styles.overlayOpen : ''].filter(Boolean).join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={[styles.sidebar, isOpen ? styles.sidebarOpen : ''].filter(Boolean).join(' ')}>
        <div className={styles.header}>
          <button className={styles.newBtn} onClick={() => { reset(); }}>
            + New Chat
          </button>
        </div>

        <div className={styles.history}>
          <h3 className={styles.historyTitle}>Recent Bookings</h3>
          <p className={styles.itemPreview} style={{ padding: '0 12px' }}>
            No recent bookings.
          </p>
        </div>

        <div className={styles.footer}>
          <div className={styles.user}>
            <div className={styles.avatar}>{initial}</div>
            <span className={styles.userName}>{userName}</span>
          </div>
          <button className={styles.settingsBtn} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
