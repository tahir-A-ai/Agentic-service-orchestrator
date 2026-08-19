import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import RegistrationWizard from '../components/provider/Registration/RegistrationWizard';
import CustomerRoleNoticeModal from '../components/auth/CustomerRoleNoticeModal';
import styles from './ProviderRegisterPage.module.css';

export default function ProviderRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (user?.role === 'provider') {
      navigate('/provider/dashboard', { replace: true });
    } else if (user?.role === 'customer') {
      setShowNotice(true);
    }
  }, [user, navigate]);

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Provider Registration</h1>
          <p className={styles.subtitle}>Karigar.pk ke sath kaam shuru karein</p>
        </div>
        
        <div className={styles.formContainer}>
          <RegistrationWizard />
        </div>
      </div>

      <CustomerRoleNoticeModal
        isOpen={showNotice}
        onClose={() => {
          setShowNotice(false);
          navigate('/');
        }}
      />
    </div>
  );
}
