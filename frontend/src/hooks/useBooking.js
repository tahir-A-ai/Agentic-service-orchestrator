import { useCallback } from 'react';
import { useChat, newId } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/core';
import { bookService, confirmBooking } from '../api/booking';

/**
 * Custom hook for the two-phase booking flow.
 * Bridges the API client with ChatContext and ToastContext.
 */
export default function useBooking() {
  const {
    sessionId,
    approvedIds,
    addMessage,
    setSessionId,
    setThinking,
    setConfirmed,
    clearApproved,
    setLastUserPrompt,
  } = useChat();

  const { showToast } = useToast();

  /**
   * Phase 1 — Send user prompt to the ReAct agent.
   * Adds user message, shows thinking state, processes response.
   */
  const findProviders = useCallback(
    async (prompt, excludedIds = []) => {
      // Add user message to chat and store prompt
      setLastUserPrompt(prompt);
      addMessage({ id: newId(), role: 'user', type: 'text', content: prompt });
      setThinking(true);

      // Ensure at least 800ms thinking state for UX
      const minDelay = new Promise((r) => setTimeout(r, 800));

      try {
        const [data] = await Promise.all([
          bookService(prompt, sessionId, excludedIds),
          minDelay,
        ]);

        // Save session ID (first call creates it, follow-ups reuse it)
        if (data.session_id) {
          setSessionId(data.session_id);
        }

        if (data.status === 'needs_clarification') {
          addMessage({
            id: newId(),
            role: 'agent',
            type: 'clarification',
            content: data.clarification_question || data.message,
          });
        } else {
          addMessage({
            id: newId(),
            role: 'agent',
            type: 'candidates',
            content: data.message,
            candidates: data.candidates || {},
          });
        }
      } catch (err) {
        const msg = getErrorMessage(err);

        // 4xx errors show inline in chat, 5xx/network show as toast
        if (err.status && err.status < 500) {
          addMessage({
            id: newId(),
            role: 'agent',
            type: 'text',
            content: msg,
          });
        } else {
          showToast(msg, 'error');
        }
      } finally {
        setThinking(false);
      }
    },
    [sessionId, addMessage, setSessionId, setThinking, showToast],
  );

  /**
   * Phase 2 — Confirm booking with approved provider IDs.
   */
  const confirm = useCallback(async (exactAddress, customerNotes) => {
    if (!sessionId || approvedIds.length === 0) return;

    setThinking(true);

    try {
      const data = await confirmBooking(sessionId, approvedIds, exactAddress, customerNotes);
      setConfirmed(data);
      clearApproved();
      return data;
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      return null;
    } finally {
      setThinking(false);
    }
  }, [sessionId, approvedIds, setThinking, setConfirmed, clearApproved, showToast]);

  return { findProviders, confirm };
}
