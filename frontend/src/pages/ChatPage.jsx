import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import useBooking from '../hooks/useBooking';
import { useChat } from '../context/ChatContext';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        <ChatWindow 
          onConfirm={handleConfirm} 
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onSend={findProviders}
        />
        <InputBar onSend={findProviders} disabled={isThinking} />
      </main>
    </div>
  );
}
