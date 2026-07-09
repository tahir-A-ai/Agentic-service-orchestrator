import React from 'react';
import styles from './LiveProviderCard.module.css';

export default function LiveProviderCard({ provider, status }) {
  const isWaiting = status === 'Pending_Acceptance';
  const isInProgress = status === 'In_Progress';
  
  // Fake ETA generation based on distance for realism
  const etaRange = provider.distance_km ? `${Math.ceil(provider.distance_km * 5 + 10)}-${Math.ceil(provider.distance_km * 5 + 25)} min` : '30-45 min';

  const getInitials = (name) => {
    if (!name) return 'PR';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className={`${styles.card} ${isInProgress ? styles.cardActiveBorder : ''}`}>
      <div className={styles.header}>
        <div className={styles.providerInfo}>
          <div className={`${styles.avatar} ${isInProgress ? styles.avatarGreen : styles.avatarDark}`}>
            {getInitials(provider.name)}
          </div>
          <div>
            <h3 className={styles.name}>{provider.name}</h3>
            <div className={styles.meta}>
              <span className={styles.serviceType}>{provider.service_type || 'Service'}</span>
              <span className={styles.metaDot}>•</span>
              <span className={styles.location}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {provider.location || 'Islamabad'}
              </span>
            </div>
          </div>
        </div>

        {/* Badge */}
        {isWaiting && (
          <div className={styles.badgePending}>
            <span className={styles.dotYellow}></span>
            Pending
          </div>
        )}
        {isInProgress && (
          <div className={styles.badgeActive}>
            <span className={styles.dotGreen}></span>
            On the Way
          </div>
        )}
      </div>

      {/* Info Row */}
      <div className={styles.infoRow}>
        <div className={styles.infoItem}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className={styles.infoTextBold}>{provider.rating || '4.5'}</span>
        </div>
        
        <div className={styles.infoItem}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className={isWaiting ? styles.infoTextGray : styles.infoTextWhite}>
            {isWaiting ? 'Calculating ETA...' : etaRange}
          </span>
        </div>

        <div className={styles.infoItem}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className={styles.infoTextGray}>{provider.distance_km ? `${provider.distance_km} km away` : 'Nearby'}</span>
        </div>
      </div>

      {/* Action Buttons (Only visible in In_Progress) */}
      {isInProgress && (
        <div className={styles.actions}>
          <button className={styles.callBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Call Provider
          </button>
          <button className={styles.mapBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            View on Map
          </button>
        </div>
      )}
    </div>
  );
}
