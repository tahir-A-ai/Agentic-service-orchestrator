import { createContext, useCallback, useContext, useState } from 'react';

/* ── Types (in JSDoc for vanilla JS) ──────────── */

/**
 * @typedef {'text'|'candidates'|'clarification'} MessageType
 * @typedef {{ id: string, role: 'user'|'agent', type: MessageType, content: string, candidates?: Object }} Message
 */

const ChatCtx = createContext(null);

export function useChat() {
  const ctx = useContext(ChatCtx);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

/** Generate a short random ID for messages. */
export function newId() {
  return Math.random().toString(36).slice(2, 11);
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [approvedIds, setApprovedIds] = useState([]);
  const [isThinking, setThinking] = useState(false);
  const [confirmed, setConfirmedState] = useState(() => {
    const saved = localStorage.getItem('karigar_confirmed_booking');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Expiry check: recovery cache is valid for 24 hours maximum
        if (!parsed.expiresAt || typeof parsed.expiresAt !== 'number' || Date.now() >= parsed.expiresAt) {
          localStorage.removeItem('karigar_confirmed_booking');
          return null;
        }
        return parsed;
      } catch (e) {
        localStorage.removeItem('karigar_confirmed_booking');
        return null;
      }
    }
    return null;
  });
  
  const setConfirmed = useCallback((data) => {
    setConfirmedState(data);
    if (data) {
      const payload = {
        ...data,
        expiresAt: data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
      };
      localStorage.setItem('karigar_confirmed_booking', JSON.stringify(payload));
    } else {
      localStorage.removeItem('karigar_confirmed_booking');
    }
  }, []);
  const [lastUserPrompt, setLastUserPrompt] = useState(null);
  const [excludedIds, setExcludedIds] = useState([]);

  const addExcludedId = useCallback((id) => {
    setExcludedIds((prev) => [...prev, id]);
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const toggleApproved = useCallback((id) => {
    setApprovedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearApproved = useCallback(() => setApprovedIds([]), []);

  const reset = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setApprovedIds([]);
    setThinking(false);
    setConfirmedState(null);
    localStorage.removeItem('karigar_confirmed_booking');
    // Note: Do NOT clear lastUserPrompt or excludedIds on reset, they are needed for the auto-fetch flow
  }, []);

  // Hard reset is used when user clicks "New Booking" to completely clear everything
  const hardReset = useCallback(() => {
    reset();
    setLastUserPrompt(null);
    setExcludedIds([]);
  }, [reset]);

  return (
    <ChatCtx.Provider
      value={{
        messages,
        addMessage,
        sessionId,
        setSessionId,
        approvedIds,
        toggleApproved,
        clearApproved,
        isThinking,
        setThinking,
        confirmed,
        setConfirmed,
        lastUserPrompt,
        setLastUserPrompt,
        excludedIds,
        addExcludedId,
        reset,
        hardReset,
      }}
    >
      {children}
    </ChatCtx.Provider>
  );
}
