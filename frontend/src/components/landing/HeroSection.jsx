import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublicStats, getServiceTypes } from '../../api/stats';
import { getIconComponent } from '../../constants/serviceIcons';
import styles from './HeroSection.module.css';

export default function HeroSection() {
  const [stats, setStats] = useState({
    providers_registered: 0,
    bookings_completed: 0,
    average_rating: 0,
  });
  
  const [services, setServices] = useState([]);

  useEffect(() => {
    getPublicStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to fetch public stats:", err));
      
    getServiceTypes()
      .then((data) => {
        if (data?.service_types) setServices(data.service_types);
      })
      .catch((err) => console.error("Failed to fetch service types:", err));
  }, []);

  return (
    <main className={styles.hero}>
      {/* Badge */}
      <div className={styles.badge}>
        AI-Powered Booking
      </div>

      {/* Headline */}
      <h1 className={styles.headline}>
        <span>Masla Bataeien</span>
        <span>Karigar Bulayein.</span>
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
      {services.length > 0 && (
        <div className={styles.servicePills}>
          {services.map((svc) => {
            const IconComponent = getIconComponent(svc.key);
            return (
              <span key={svc.key} className={styles.pill}>
                <span className={styles.pillIcon} style={{ color: svc.theme_color }}>
                  <IconComponent size={14} color="currentColor" />
                </span>
                {svc.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{stats.providers_registered}+</span>
          <span className={styles.statLabel}>Providers Registered</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statNum}>{stats.bookings_completed}+</span>
          <span className={styles.statLabel}>Bookings Completed</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statNum}>
            {stats.average_rating}
            <span className={styles.starIcon}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </span>
          </span>
          <span className={styles.statLabel}>Average Rating</span>
        </div>
      </div>
    </main>
  );
}
