import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Navbar />

      {/* Animated background */}
      <div className={styles.gridBg} aria-hidden="true" />

      <main className={styles.hero}>
        {/* Badge */}
        <div className={styles.badge}>
          <span className={styles.badgeIcon}>🤖</span>
          AI-Powered Booking
        </div>

        {/* Headline */}
        <h1 className={styles.headline}>
          <span>Ghar Ki Zaroorat?</span>
          <span>Bas Likho, Hum Karein.</span>
        </h1>

        <p className={styles.subtext}>
          Islamabad ka pehla AI booking platform. Roman Urdu mein type karein,
          seconds mein service book karein.
        </p>

        {/* CTA Cards */}
        <div className={styles.ctaRow}>
          {/* Customer Card */}
          <Link to="/chat" className={[styles.ctaCard, styles.customerCard].join(' ')}>
            <div className={styles.ctaIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className={styles.ctaTitle}>Mujhe Service Chahiye</h3>
            <p className={styles.ctaSubtitle}>
              Plumber, Electrician, ya AC Technician — AI se baat karo
            </p>
            <span className={styles.ctaButton}>
              Chat Shuru Karein →
            </span>
          </Link>

          {/* Provider Card */}
          <Link to="/provider/register" className={[styles.ctaCard, styles.providerCard].join(' ')}>
            <div className={[styles.ctaIcon, styles.blueIcon].join(' ')}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h3 className={styles.ctaTitle}>Main Provider Hoon</h3>
            <p className={styles.ctaSubtitle}>
              Register karein aur apne area mein kaam pao
            </p>
            <span className={[styles.ctaButton, styles.blueBtn].join(' ')}>
              Register Karein →
            </span>
          </Link>
        </div>

        {/* Service Pills */}
        <div className={styles.servicePills}>
          <span className={styles.pill}>❄️ AC Technician</span>
          <span className={styles.pill}>⚡ Electrician</span>
          <span className={styles.pill}>🔧 Plumber</span>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>500+</span>
            <span className={styles.statLabel}>Providers Registered</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>2,000+</span>
            <span className={styles.statLabel}>Bookings Completed</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>4.8★</span>
            <span className={styles.statLabel}>Average Rating</span>
          </div>
        </div>
      </main>
    </div>
  );
}
