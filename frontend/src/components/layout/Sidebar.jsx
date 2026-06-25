import { Link } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { mockChatHistory } from '../../data/mockData';
import styles from './Sidebar.module.css';

/**
 * Chat sidebar for history and new chat.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { reset } = useChat();

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
          <Link to="/" className={styles.backLink}>← Back</Link>
          <button className={styles.newBtn} onClick={() => { reset(); onClose?.(); }}>
            + New Chat
          </button>
        </div>

        <div className={styles.history}>
          <h3 className={styles.historyTitle}>Recent Bookings</h3>
          <ul className={styles.list}>
            {mockChatHistory.map((item) => (
              <li key={item.id}>
                <button className={styles.historyItem}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemTime}>{item.timeAgo}</span>
                  </div>
                  <span className={styles.itemPreview}>{item.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.footer}>
          <div className={styles.user}>
            <div className={styles.avatar}>GU</div>
            <span className={styles.userName}>Guest User</span>
          </div>
          <button className={styles.settingsBtn} aria-label="Settings">⚙️</button>
        </div>
      </aside>
    </>
  );
}
