import { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { syncConversation, beaconSync } from '../api/chat';
import { useAuth } from '../context/AuthContext';
import { deriveTitle } from '../utils/chat';

/**
 * useChatSync — transparent background sync hook.
 *
 * Mount this once inside ChatPage. It watches isThinking and fires a DB
 * sync whenever the agent finishes responding (isThinking: true → false).
 * Also registers beforeunload / pagehide listeners that use sendBeacon so partial
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

  // Keep refs current so unload closures always see latest data
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Trigger: isThinking flips false OR message count changes
  const prevMsgCountRef = useRef(messages.length);

  useEffect(() => {
    const wasThinking = prevThinkingRef.current;
    prevThinkingRef.current = isThinking;

    const prevCount = prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;

    const thinkingFinished = wasThinking && !isThinking;
    const msgAddedWhenIdle = messages.length > prevCount && !isThinking;

    if (!thinkingFinished && !msgAddedWhenIdle) return;
    if (!sessionId || !user) return;
    if (messages.length === 0) return;

    const title = deriveTitle(messages);
    syncConversation(sessionId, { title, messages }).catch(() => {
      // Sync failure is non-fatal — conversation is still intact in memory
    });
  }, [isThinking, sessionId, messages, user]);


  // ── Trigger: beforeunload / pagehide (tab close / navigation away)
  useEffect(() => {
    function handleUnload() {
      const sid = sessionIdRef.current;
      const msgs = messagesRef.current;
      if (!sid || !user || msgs.length === 0) return;
      beaconSync(sid, { title: deriveTitle(msgs), messages: msgs });
    }

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [user]);
}

