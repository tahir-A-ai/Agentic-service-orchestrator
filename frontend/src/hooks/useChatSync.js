import { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { syncConversation, beaconSync } from '../api/chat';
import { useAuth } from '../context/AuthContext';

/**
 * useChatSync — transparent background sync hook.
 *
 * Mount this once inside ChatPage. It watches isThinking and fires a DB
 * sync whenever the agent finishes responding (isThinking: true → false).
 * Also registers a beforeunload listener that uses sendBeacon so partial
 * state is preserved even if the user closes the tab mid-conversation.
 *
 * This hook produces ZERO UI — it's purely a side-effect.
 */
export default function useChatSync() {
  const { messages, sessionId, isThinking } = useChat();
  const { user } = useAuth();

  const prevThinkingRef = useRef(false);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);

  // Keep refs current so beforeunload closure always sees latest data
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Trigger: isThinking flips false
  useEffect(() => {
    const wasThinking = prevThinkingRef.current;
    prevThinkingRef.current = isThinking;

    // Only sync on the transition true → false (agent finished responding)
    if (!wasThinking || isThinking) return;
    if (!sessionId || !user) return;
    if (messages.length === 0) return;

    const title = deriveTitle(messages);
    syncConversation(sessionId, { title, messages }).catch(() => {
      // Sync failure is non-fatal — conversation is still intact in memory
    });
  }, [isThinking, sessionId, messages, user]);

  // ── Trigger: beforeunload (tab close / navigation away)
  useEffect(() => {
    function handleUnload() {
      const sid = sessionIdRef.current;
      const msgs = messagesRef.current;
      if (!sid || !user || msgs.length === 0) return;
      beaconSync(sid, { title: deriveTitle(msgs), messages: msgs });
    }

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);
}

/**
 * Derive a conversation title from the message array.
 * Uses the first user message longer than 5 characters.
 */
export function deriveTitle(messages) {
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = (msg.content || '').trim();
      if (content.length > 5) return content.slice(0, 100);
    }
  }
  // Fallback to any user message
  const firstUser = messages.find((m) => m.role === 'user');
  return firstUser ? (firstUser.content || 'New Chat').slice(0, 100) : 'New Chat';
}
