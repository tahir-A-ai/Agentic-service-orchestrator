import { createContext, useCallback, useContext, useState } from 'react';
import { getConversation, syncConversation } from '../api/chat';
import { deriveTitle } from '../hooks/useChatSync';

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

/**
 * Generates a short identifier for a message.
 * @returns {string} A randomly generated base-36 identifier.
 */
export function newId() {
  return Math.random().toString(36).slice(2, 11);
}

// ── Minimal localStorage usage
// Only the active chat UUID is stored here (36 bytes).
// All message content lives in the DB + React state only.

const ACTIVE_CHAT_KEY = 'karigar_active_chat_id';

/**
 * Retrieves the identifier of the active chat session.
 * @returns {string|null} The active chat ID, or `null` when none is stored or storage access fails.
 */
function getActiveChatId() {
  try { return localStorage.getItem(ACTIVE_CHAT_KEY); } catch { return null; }
}
/**
 * Persists or clears the active chat identifier.
 * @param {string} id - The chat identifier to store, or an empty value to clear it.
 */
function setActiveChatId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch { /* quota — skip */ }
}

/**
 * Provides chat state and actions to descendant components through React context.
 * @returns {JSX.Element} The chat context provider.
 */
export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionIdState] = useState(null);
  const [approvedIds, setApprovedIds] = useState([]);
  const [isThinking, setThinking] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState(null);
  const [excludedIds, setExcludedIds] = useState([]);

  // confirmed booking — tiny payload, kept in localStorage (24 h TTL)
  const [confirmed, setConfirmedState] = useState(() => {
    const raw = localStorage.getItem('karigar_confirmed_booking');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.expiresAt || Date.now() >= parsed.expiresAt) {
          localStorage.removeItem('karigar_confirmed_booking');
          return null;
        }
        return parsed;
      } catch {
        localStorage.removeItem('karigar_confirmed_booking');
      }
    }
    return null;
  });

  // ── setSessionId: also persist the active chat UUID 
  const setSessionId = useCallback((id) => {
    setSessionIdState(id);
    setActiveChatId(id);
  }, []);

  // ── loadConversation: rehydrate state from DB
  // Called on mount (resume after reload) or when user clicks a sidebar entry.

  const loadConversation = useCallback(async (id) => {
    try {
      const data = await getConversation(id);
      setMessages(data.messages || []);
      setSessionIdState(data.id);
      setActiveChatId(data.id);
      // Reset ephemeral state
      setApprovedIds([]);
      setThinking(false);
      setExcludedIds([]);
    } catch {
      // Conversation not found or auth error — start fresh
      setActiveChatId(null);
    }
  }, []);

  // ── addMessage
  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // ── excludedIds

  const addExcludedId = useCallback((id) => {
    setExcludedIds((prev) => [...prev, id]);
  }, []);

  // ── approvedIds

  const toggleApproved = useCallback((id) => {
    setApprovedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearApproved = useCallback(() => setApprovedIds([]), []);

  // ── confirmed booking

  const setConfirmed = useCallback((data) => {
    setConfirmedState(data);
    if (data) {
      const payload = {
        ...data,
        expiresAt: data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000),
      };
      localStorage.setItem('karigar_confirmed_booking', JSON.stringify(payload));
    } else {
      localStorage.removeItem('karigar_confirmed_booking');
    }
  }, []);

  // ── Reset

  const reset = useCallback(() => {
    setMessages([]);
    setSessionIdState(null);
    setApprovedIds([]);
    setThinking(false);
    setConfirmedState(null);
    setActiveChatId(null);
    setLastUserPrompt(null);
    setExcludedIds([]);
    localStorage.removeItem('karigar_confirmed_booking');
  }, []);

  // hardReset: flush current chat to DB first, then wipe everything.
  // The sync is best-effort — if it fails we still reset.
  const hardReset = useCallback(
    (currentSessionId, currentMessages) => {
      if (currentSessionId && currentMessages && currentMessages.length > 0) {
        syncConversation(currentSessionId, {
          title: deriveTitle(currentMessages),
          messages: currentMessages,
        }).catch(() => { });
      }
      reset();
      setLastUserPrompt(null);
      setExcludedIds([]);
    },
    [reset],
  );

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
        loadConversation,
        getActiveChatId,
      }}
    >
      {children}
    </ChatCtx.Provider>
  );
}
