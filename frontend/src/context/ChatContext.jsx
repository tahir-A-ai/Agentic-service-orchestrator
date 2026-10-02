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
  const [conversationId, setConversationIdState] = useState(getActiveChatId);
  const [approvedIds, setApprovedIds] = useState([]);
  const [isThinking, setThinking] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState(null);
  const [excludedIds, setExcludedIds] = useState([]);
  const latestLoadIdRef = useRef(null);

  // confirmed booking — tiny payload, kept in localStorage (24 h TTL)
  const [confirmed, setConfirmedState] = useState(getStoredConfirmedBooking);

  // ── setSessionId: updates the active booking session ID
  // If conversationId is not yet established (new chat), binds conversationId as well.
  const setSessionId = useCallback((id) => {
    setSessionIdState(id);
    setConversationIdState((prev) => {
      if (!prev) {
        setActiveChatId(id);
        return id;
      }
      return prev;
    });
  }, []);

  // ── loadConversation: rehydrate state from DB
  // Called on mount (resume after reload) or when user clicks a sidebar entry.

  const loadConversation = useCallback(async (id) => {
    latestLoadIdRef.current = id;
    try {
      const data = await getConversation(id);
      // Guard against race conditions if user switched to another chat while request was in-flight
      if (latestLoadIdRef.current !== id) return;
      const msgs = data.messages || [];
      setMessages(msgs);
      setSessionIdState(data.booking_session_id || data.id);
      setConversationIdState(data.id);
      setActiveChatId(data.id);
      // Reset ephemeral state
      setApprovedIds([]);
      setThinking(false);
      setLastUserPrompt(null);

      // Rehydrate excludedIds from persisted unavailable flags in candidate messages
      const recoveredExcluded = new Set();
      msgs.forEach((m) => {
        if (m.type === 'candidates' && m.candidates) {
          Object.values(m.candidates).forEach((providersList) => {
            if (Array.isArray(providersList)) {
              providersList.forEach((p) => {
                if (p.unavailable) {
                  recoveredExcluded.add(p.id);
                }
              });
            }
          });
        }
      });
      setExcludedIds(Array.from(recoveredExcluded));
    } catch {
      if (latestLoadIdRef.current === id) {
        // Conversation not found or auth error — start fresh
        setActiveChatId(null);
        setConversationIdState(null);
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

  // ── Unlock candidate messages (allows unexcluded candidates to be selected after provider cancellation)
  const unlockCandidateMessages = useCallback(() => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.type === 'candidates' ? { ...msg, locked: false } : msg
      )
    );
  }, []);

  // ── Mark a specific provider as unavailable in candidate messages and excludedIds
  const markProviderUnavailable = useCallback((providerId) => {
    if (!providerId) return;
    setExcludedIds((prev) => (prev.includes(providerId) ? prev : [...prev, providerId]));
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.type !== 'candidates' || !msg.candidates) return msg;
        const updatedCandidates = {};
        for (const [svc, pList] of Object.entries(msg.candidates)) {
          if (Array.isArray(pList)) {
            updatedCandidates[svc] = pList.map((p) =>
              p.id === providerId ? { ...p, unavailable: true } : p
            );
          } else {
            updatedCandidates[svc] = pList;
          }
        }
        return { ...msg, candidates: updatedCandidates };
      })
    );
  }, []);

  // ── Reset
  const reset = useCallback(() => {

    setMessages([]);
    setSessionIdState(null);
    setConversationIdState(null);
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
    async (currentChatId, currentMessages) => {
      const cid = currentChatId || conversationId || sessionId;
      const msgs = currentMessages || messages;
      if (cid && msgs && msgs.length > 0) {
        try {
          await syncConversation(cid, {
            title: deriveTitle(msgs),
            messages: msgs,
            bookingSessionId: sessionId,
          });
        } catch { }
      }
      reset();
    },
    [reset, conversationId, sessionId, messages],
  );


  return (
    <ChatCtx.Provider
      value={{
        messages,
        addMessage,
        sessionId,
        setSessionId,
        conversationId,
        setConversationId: setConversationIdState,
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
        markProviderUnavailable,
        lockCandidateMessages,
        unlockCandidateMessages,
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
