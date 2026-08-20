import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { listConversations, deleteConversation } from '../../api/chat';
import styles from './Sidebar.module.css';

/**
 * Renders a trash-can icon.
 * @return {JSX.Element} The trash-can SVG element.
 */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

/**
 * Formats a timestamp as a localized relative time label.
 * @param {string} dateStr - The timestamp to format, interpreted as UTC when no timezone suffix is provided.
 * @returns {string} A relative time label in Urdu or a formatted Pakistan date.
 */
function relativeTime(dateStr) {
  // Backend stores UTC datetimes without a 'Z' suffix.
  // Without it, new Date() treats the string as local time — append 'Z' to force UTC parsing.
  const normalized = dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+') ? dateStr + 'Z' : dateStr;
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Abhi';
  if (mins < 60) return `${mins}m pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h pehle`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Kal';
  if (days < 7) return `${days} din pehle`;
  return new Date(normalized).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}


/**
 * Render a responsive sidebar for creating, browsing, selecting, and deleting chats.
 * @param {boolean} isOpen - Whether the sidebar is open on mobile screens.
 * @param {Function} [onClose] - Callback invoked when the mobile sidebar should close.
 * @returns {JSX.Element} The chat sidebar interface.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { messages, sessionId, hardReset, reset, loadConversation } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const userName = user?.full_name || user?.email || 'Guest User';
  const initial = userName.substring(0, 2).toUpperCase();

  // ── Fetch sidebar list

  const fetchConversations = useCallback(async (p = 1, append = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listConversations(p);
      setConversations((prev) =>
        append ? [...prev, ...(data.conversations || [])] : (data.conversations || []),
      );
      setHasMore(data.has_more ?? false);
      setPage(p);
    } catch {
      // non-fatal — sidebar just shows empty
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations(1);
  }, [fetchConversations]);

  const handleNewChat = () => {
    hardReset(sessionId, messages);
    navigate('/chat');
    if (window.innerWidth <= 768) {
      onClose?.();
    }
    // Refresh list after a tick so new empty session shows
    setTimeout(() => fetchConversations(1), 300);
  };

  const handleSelectConversation = async (id) => {
    await loadConversation(id);
    navigate('/chat');
    if (window.innerWidth <= 768) {
      onClose?.();
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (sessionId === id) {
        reset();
      }
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadMore = () => fetchConversations(page + 1, true);

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
          <button className={styles.newBtn} onClick={handleNewChat}>
            + New Chat
          </button>
        </div>

        <div className={styles.history}>
          <h3 className={styles.historyTitle}>Recent Chats</h3>

          {loading && conversations.length === 0 ? (
            <p className={styles.emptyMsg}>Loading...</p>
          ) : conversations.length === 0 ? (
            <p className={styles.emptyMsg}>Koi previous chat nahi.</p>
          ) : (
            <div className={styles.list}>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={[
                    styles.historyItem,
                    conv.id === sessionId ? styles.historyItemActive : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSelectConversation(conv.id)}
                  title={conv.title}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{conv.title}</span>
                    <span className={styles.itemTime}>{relativeTime(conv.created_at || conv.updated_at)}</span>
                  </div>

                  {/* Delete button — shown on hover via CSS */}
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, conv.id)}
                    disabled={deletingId === conv.id}
                    aria-label={`Delete: ${conv.title}`}
                    title="Delete chat"
                  >
                    <TrashIcon />
                  </button>
                </button>
              ))}

              {hasMore && (
                <button className={styles.loadMore} onClick={handleLoadMore} disabled={loading}>
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}
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
