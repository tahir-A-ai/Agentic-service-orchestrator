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
    lockCandidateMessages,
    setLastUserPrompt,
  } = useChat();

  const { showToast } = useToast();

  /**
   * Phase 1 — Send user prompt to the ReAct agent.
   * Adds user message, shows thinking state, processes response.
   */
  const findProviders = useCallback(
    async (prompt, excludedIdsList = [], options = {}) => {
      // Add user message to chat and store prompt
      setLastUserPrompt(prompt);
      if (!options.skipUserMessage) {
        addMessage({ id: newId(), role: 'user', type: 'text', content: prompt });
      }
      setThinking(true);

      // Ensure at least 800ms thinking state for UX
      const minDelay = new Promise((r) => setTimeout(r, 800));

      try {
        const [data] = await Promise.all([
          bookService(prompt, sessionId, excludedIdsList),
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
        const isTimeout = err?.message === 'Request timed out';
        const msg = isTimeout
          ? 'Server se response nahi aya (timeout). Dobara try karein.'
          : getErrorMessage(err);

        // Timeout and 4xx: show inline in chat so the user can retry in context.
        // 5xx / network errors: show as toast (likely transient infra issue).
        if (isTimeout || (err.status && err.status < 500)) {
          addMessage({
            id: newId(),
            role: 'agent',
            type: isTimeout ? 'timeout' : 'text',
            content: msg,
            // Attach retry metadata so ChatMessage can render a Retry button
            retryPrompt: isTimeout ? prompt : undefined,
          });
        } else {
          showToast(msg, 'error');
        }
      } finally {
        setThinking(false);
      }
    },
    [sessionId, addMessage, setSessionId, setThinking, showToast, setLastUserPrompt],
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
      lockCandidateMessages();
      return data;
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      return null;
    } finally {
      setThinking(false);
    }
  }, [sessionId, approvedIds, setThinking, setConfirmed, clearApproved, lockCandidateMessages, showToast]);


  return { findProviders, confirm };
}
