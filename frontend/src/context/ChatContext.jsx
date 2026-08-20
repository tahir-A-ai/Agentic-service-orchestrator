import { createContext, useCallback, useContext, useState, useRef } from 'react';
import { getConversation, syncConversation } from '../api/chat';
import { deriveTitle } from '../utils/chat';

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

// ── Minimal localStorage usage
// Only the active chat UUID is stored here (36 bytes).
// All message content lives in the DB + React state only.

const ACTIVE_CHAT_KEY = 'karigar_active_chat_id';
const CONFIRMED_BOOKING_KEY = 'karigar_confirmed_booking';

function getActiveChatId() {
  try { return localStorage.getItem(ACTIVE_CHAT_KEY); } catch { return null; }
}
function setActiveChatId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch { /* quota — skip */ }
}

function getStoredConfirmedBooking() {
  try {
    const raw = localStorage.getItem(CONFIRMED_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(CONFIRMED_BOOKING_KEY);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(CONFIRMED_BOOKING_KEY); } catch { }
    return null;
  }
}

function setStoredConfirmedBooking(data) {
  try {
    if (data) {
      const payload = {
        ...data,
        expiresAt: data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000),
      };
      localStorage.setItem(CONFIRMED_BOOKING_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(CONFIRMED_BOOKING_KEY);
    }
  } catch { /* quota — skip */ }
}

// ── Provider
export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionIdState] = useState(null);
  const [approvedIds, setApprovedIds] = useState([]);
  const [isThinking, setThinking] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState(null);
  const [excludedIds, setExcludedIds] = useState([]);
  const latestLoadIdRef = useRef(null);

  // confirmed booking — tiny payload, kept in localStorage (24 h TTL)
  const [confirmed, setConfirmedState] = useState(getStoredConfirmedBooking);

  // ── setSessionId: also persist the active chat UUID 
  const setSessionId = useCallback((id) => {
    setSessionIdState(id);
    setActiveChatId(id);
  }, []);

  // ── loadConversation: rehydrate state from DB
  // Called on mount (resume after reload) or when user clicks a sidebar entry.

  const loadConversation = useCallback(async (id) => {
    latestLoadIdRef.current = id;
    try {
      const data = await getConversation(id);
      // Guard against race conditions if user switched to another chat while request was in-flight
      if (latestLoadIdRef.current !== id) return;
      setMessages(data.messages || []);
      setSessionIdState(data.id);
      setActiveChatId(data.id);
      // Reset ephemeral state
      setApprovedIds([]);
      setThinking(false);
      setExcludedIds([]);
      setLastUserPrompt(null);
    } catch {
      if (latestLoadIdRef.current === id) {
        // Conversation not found or auth error — start fresh
        setActiveChatId(null);
      }
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
    setStoredConfirmedBooking(data);
  }, []);

  // ── Lock candidate messages (prevents clicking previous approve buttons)
  const lockCandidateMessages = useCallback(() => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.type === 'candidates' ? { ...msg, locked: true } : msg
      )
    );
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
    setStoredConfirmedBooking(null);
  }, []);

  // hardReset: flush current chat to DB first, then wipe everything.
  // Returns promise so callers can wait for sync completion.
  const hardReset = useCallback(
    async (currentSessionId, currentMessages) => {
      const sid = currentSessionId || sessionId;
      const msgs = currentMessages || messages;
      if (sid && msgs && msgs.length > 0) {
        try {
          await syncConversation(sid, {
            title: deriveTitle(msgs),
            messages: msgs,
          });
        } catch { }
      }
      reset();
    },
    [reset, sessionId, messages],
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
        lockCandidateMessages,
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
