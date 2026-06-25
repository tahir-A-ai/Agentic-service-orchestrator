import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import useBooking from '../hooks/useBooking';
import { useChat } from '../context/ChatContext';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { findProviders, confirm } = useBooking();
  const { isThinking } = useChat();
  const navigate = useNavigate();

  const handleConfirm = async () => {
    const res = await confirm();
    if (res && res.session_id) {
      navigate('/chat/confirmed');
    }
  };

  return (
    <div className={styles.layout}>
      {/* Mobile Header (Hamburger) */}
      <div className={styles.mobileHeader}>
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
          ☰
        </button>
        <span className={styles.logoText}>Karigar.pk</span>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        <ChatWindow onConfirm={handleConfirm} />
        <InputBar onSend={findProviders} disabled={isThinking} />
      </main>
    </div>
  );
}
