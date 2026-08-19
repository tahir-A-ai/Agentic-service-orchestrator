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
  const { isThinking, excludedIds, addMessage, messages, loadConversation, getActiveChatId } = useChat();
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

    // Don't rehydrate if we're about to auto-fetch a new session (autoFetch state)
    if (location.state?.autoFetch || location.state?.customerCancelled) return;

    const savedId = getActiveChatId();
    if (savedId && messages.length === 0) {
      loadConversation(savedId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fetch from navigation state (e.g. service card click)
  useEffect(() => {
    if (location.state?.autoFetch && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      setTimeout(() => {
        findProviders(location.state.autoFetch, excludedIds);
      }, 100);
      window.history.replaceState({}, document.title);
    } else if (location.state?.customerCancelled && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      addMessage({
        id: newId(),
        role: 'agent',
        type: 'text',
        content: 'Aapne request cancel kar di. Kia ap kisi aur provider ki service book karna chahte hain?',
      });
      window.history.replaceState({}, document.title);
    }
  }, [location, findProviders, excludedIds, addMessage]);

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
