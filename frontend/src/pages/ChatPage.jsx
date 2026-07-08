import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import AddressModal from '../components/booking/AddressModal';
import useBooking from '../hooks/useBooking';
import { useChat } from '../context/ChatContext';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { findProviders, confirm } = useBooking();
  const { isThinking } = useChat();
  const navigate = useNavigate();

  const handleConfirmClick = () => {
    setIsModalOpen(true);
  };

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
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onSend={findProviders}
        />
        <InputBar onSend={findProviders} disabled={isThinking} />
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
