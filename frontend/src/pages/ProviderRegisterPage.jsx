import Navbar from '../components/layout/Navbar';
import RegistrationWizard from '../components/provider/RegistrationWizard';
import styles from './ProviderRegisterPage.module.css';

export default function ProviderRegisterPage() {
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
    </div>
  );
}
