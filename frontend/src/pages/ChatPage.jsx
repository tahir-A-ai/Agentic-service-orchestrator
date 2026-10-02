import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import AddressModal from '../components/booking/AddressModal';
import useBooking from '../hooks/useBooking';
import useChatSync from '../hooks/useChatSync';
import { useChat, newId } from '../context/ChatContext';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { findProviders, confirm } = useBooking();
  const {
    isThinking,
    excludedIds,
    addExcludedId,
    markProviderUnavailable,
    addMessage,
    messages,
    loadConversation,
    getActiveChatId,
    lockCandidateMessages,
    unlockCandidateMessages,
    clearApproved,
  } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoFetched = useRef(false);
  const hasRehydrated = useRef(false);

  // Mount the background sync hook (fires on isThinking flip + beforeunload)
  useChatSync();

  // ── Rehydrate from DB on page reload
  useEffect(() => {
    if (hasRehydrated.current) return;
    hasRehydrated.current = true;

    // Skip DB rehydration for any navigation-state driven scenario —
    // jobCompleted, providerCancelled, customerCancelled all inject their
    // own messages and must NOT be overwritten by a stale DB load.
    const ls = location.state || {};
    if (ls.jobCompleted || ls.providerCancelled || ls.customerCancelled || ls.autoFetch) return;

    const savedId = getActiveChatId();
    if (savedId && messages.length === 0) {
      loadConversation(savedId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fetch and navigation state handling
  useEffect(() => {
    if (hasAutoFetched.current) return;

    if (location.state?.jobCompleted) {
      hasAutoFetched.current = true;
      // Reload the conversation from DB first so the provider card is visible
      // and can be locked — otherwise messages is empty after setConfirmed(null)
      const savedId = getActiveChatId();
      const afterLoad = async () => {
        if (savedId) {
          await loadConversation(savedId);
        }
        lockCandidateMessages();
        clearApproved();
        addMessage({
          id: newId(),
          role: 'agent',
          type: 'text',
          content: 'Yeh job kamyabi se mukammal ho chuki hai aur aapka review darj ho gaya hai. Shukriya!',
        });
      };
      afterLoad();
      window.history.replaceState({}, document.title);
    } else if (location.state?.providerCancelled) {
      hasAutoFetched.current = true;
      unlockCandidateMessages();
      clearApproved();
      const providerName = location.state.providerName || 'Provider';
      const prompt = location.state.autoFetch;
      const providerId = location.state.providerId;
      if (providerId) {
        markProviderUnavailable(providerId);
      }
      const updatedExcluded = providerId
        ? Array.from(new Set([...excludedIds, providerId]))
        : excludedIds;

      // 1. Post friendly Roman Urdu notification from agent
      addMessage({
        id: newId(),
        role: 'agent',
        type: 'text',
        content: `${providerName} ne request cancel kar di hai. Hum aapke liye doosra provider dhoond rahe hain...`,
      });

      // 2. Search for alternative providers with clean session
      if (prompt) {
        setTimeout(() => {
          findProviders(prompt, updatedExcluded, { skipUserMessage: true, newSession: true });
        }, 600);
      }
      window.history.replaceState({}, document.title);
    } else if (location.state?.autoFetch) {
      hasAutoFetched.current = true;
      setTimeout(() => {
        findProviders(location.state.autoFetch, excludedIds);
      }, 100);
      window.history.replaceState({}, document.title);
    } else if (location.state?.customerCancelled) {
      hasAutoFetched.current = true;
      lockCandidateMessages();
      clearApproved();
      addMessage({
        id: newId(),
        role: 'agent',
        type: 'text',
        content: 'Aapne request cancel kar di. Kia aap kisi aur provider ki service book karna chahte hain?',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location, findProviders, excludedIds, addExcludedId, markProviderUnavailable, addMessage, loadConversation, lockCandidateMessages, unlockCandidateMessages, clearApproved]);




  const handleConfirmClick = () => setIsModalOpen(true);

  const handleModalSubmit = async ({ exactAddress, customerNotes }) => {
    setIsSubmitting(true);
    const res = await confirm(exactAddress, customerNotes);
    setIsSubmitting(false);
    setIsModalOpen(false);
    if (res && res.session_id) {
      navigate('/chat/confirmed');
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        <ChatWindow
          onConfirm={handleConfirmClick}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onSend={(text) => findProviders(text, excludedIds)}
        />
        <InputBar onSend={(text) => findProviders(text, excludedIds)} disabled={isThinking} />
      </main>

      <AddressModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
