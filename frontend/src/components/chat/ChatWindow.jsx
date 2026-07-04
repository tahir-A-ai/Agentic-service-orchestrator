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
export default function ChatWindow({ onConfirm }) {
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
        <div className={styles.headerTitle}>
          <div className={styles.agentAvatar}>
            <span className={styles.agentStatus} />
          </div>
          <div>
            <h2 className={styles.agentName}>Karigar AI</h2>
            <p className={styles.agentSub}>Roman Urdu mein type karein</p>
          </div>
        </div>
        <button className={styles.infoBtn} aria-label="Information">ℹ️</button>
      </header>

      {/* Messages Area */}
      <div className={styles.messages} ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && !isThinking ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👋</span>
            <p>Aapko kaunsi service chahiye?</p>
            <span className={styles.emptyHint}>Example: G-13 mein bijli wala chahiye</span>
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
