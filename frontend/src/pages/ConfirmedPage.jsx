import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import BookingReceipt from '../components/booking/BookingReceipt';
import Button from '../components/ui/Button';
import styles from './ConfirmedPage.module.css';

export default function ConfirmedPage() {
  const { confirmed, reset } = useChat();
  const navigate = useNavigate();

  // If accessed directly without a confirmed booking, redirect to home
  useEffect(() => {
    if (!confirmed) {
      navigate('/');
    }
  }, [confirmed, navigate]);

  if (!confirmed) return null;

  const handleNewBooking = () => {
    reset();
    navigate('/chat');
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Success Animation */}
        <div className={styles.iconWrapper}>
          <svg className={styles.checkIcon} viewBox="0 0 52 52">
            <circle className={styles.checkCircle} cx="26" cy="26" r="25" fill="none" />
            <path className={styles.checkPath} fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>

        <h1 className={styles.title}>Booking Confirmed!</h1>
        <p className={styles.subtitle}>Aapka karigar aa raha hai.</p>

        {/* Booked Providers */}
        <div className={styles.receipts}>
          {confirmed.booked?.map((provider) => (
            <BookingReceipt key={provider.id} provider={provider} />
          ))}
        </div>

        {/* Failed Providers Warning */}
        {confirmed.failed && confirmed.failed.length > 0 && (
          <div className={styles.warningBox}>
            <span className={styles.warningIcon}>⚠</span>
            <div className={styles.warningText}>
              <strong>Kuch providers busy ho gaye.</strong>
              <p>Inke liye aap dobara try kar sakte hain.</p>
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className={styles.sessionInfo}>
          Booking ID: {confirmed.session_id}
        </div>

        <Button fullWidth onClick={handleNewBooking} className={styles.newBtn}>
          New Booking
        </Button>
      </div>
    </div>
  );
}
