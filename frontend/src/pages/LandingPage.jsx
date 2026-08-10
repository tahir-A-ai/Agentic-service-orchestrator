import { Navigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import HeroSection from '../components/landing/HeroSection';
import ServicesSection from '../components/landing/ServicesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import { useAuth } from '../context/AuthContext';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const { user } = useAuth();

  if (user?.role === 'provider') {
    return <Navigate to="/provider/dashboard" replace />;
  }

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Animated background */}
      <div className={styles.gridBg} aria-hidden="true" />

      <HeroSection />
      <ServicesSection />
      <HowItWorksSection />
    </div>
  );
}
