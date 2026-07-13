import Navbar from '../components/layout/Navbar';
import HeroSection from '../components/landing/HeroSection';
import ServicesSection from '../components/landing/ServicesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import styles from './LandingPage.module.css';

export default function LandingPage() {
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
