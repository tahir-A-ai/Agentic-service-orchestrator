import { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import MessageBubble from './MessageBubble';
import ThinkingDots from './ThinkingDots';
import CandidateGrid from '../booking/CandidateGrid';
import ConfirmButton from '../booking/ConfirmButton';
import styles from './ChatWindow.module.css';

/**
 * Main chat window.
 *
 * @param {function} onConfirm — Phase 2 trigger
 */
export default function ChatWindow({ onConfirm, onToggleSidebar, onSend }) {
  const { messages, isThinking, approvedIds, toggleApproved } = useChat();
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isThinking]);

  return (
    <div className={styles.window}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.menuBtn} onClick={onToggleSidebar} aria-label="Toggle Sidebar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className={styles.headerTitle}>
            <div className={styles.agentAvatar}>
              <span className={styles.agentStatus} />
            </div>
            <div>
              <h2 className={styles.agentName}>Karigar AI</h2>
              <p className={styles.agentSub}>Roman Urdu mein type karein</p>
            </div>
          </div>
        </div>
        <button className={styles.infoBtn} aria-label="Information">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </header>

      {/* Messages Area */}
      <div className={styles.messages} ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && !isThinking ? (
          <div className={styles.empty}>
            <div className={styles.emptyLogo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>Karigar AI Ready Hai</h2>
            <p className={styles.emptySubtitle}>
              Roman Urdu mein apni zaroorat likhein. Jaise:<br />
              "G-13 mein bijli wala chahiye"
            </p>
            <div className={styles.suggestions}>
              <button className={styles.suggestionBtn} onClick={() => onSend('G-13 mein bijli wala bhejo')}>G-13 mein bijli wala bhejo</button>
              <button className={styles.suggestionBtn} onClick={() => onSend('Plumber chahiye H-13 mein')}>Plumber chahiye H-13 mein</button>
              <button className={styles.suggestionBtn} onClick={() => onSend('AC fix karwani hai')}>AC fix karwani hai</button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role}>
              {/* Text content */}
              <div className={msg.type === 'clarification' ? styles.clarification : ''}>
                {msg.content}
              </div>

              {/* Candidates Grid (if any) */}
              {msg.type === 'candidates' && msg.candidates && (
                <CandidateGrid
                  candidates={msg.candidates}
                  approvedIds={approvedIds}
                  onToggle={toggleApproved}
                />
              )}
            </MessageBubble>
          ))
        )}

        {isThinking && (
          <MessageBubble role="agent">
            <ThinkingDots />
          </MessageBubble>
        )}

        {/* Sticky Confirm Button */}
        {approvedIds.length > 0 && !isThinking && (
          <ConfirmButton count={approvedIds.length} onClick={onConfirm} />
        )}
      </div>
    </div>
  );
}
