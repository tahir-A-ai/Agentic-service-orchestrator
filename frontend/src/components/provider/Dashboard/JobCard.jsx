import { useState } from 'react';
import Badge from '../../ui/Badge';
import styles from './JobCard.module.css';

/**
 * Card displaying a job in the provider dashboard.
 *
 * @param {Object} job
 * @param {string} variant - 'compact' (read-only list) or 'full' (expandable with actions)
 * @param {boolean} readOnly - true for completed jobs in full variant
 */
export default function JobCard({ job, variant = 'full', readOnly = false }) {
  // First item expanded for demo purposes if full variant
  const [expanded, setExpanded] = useState(job.id === 'job-1');

  const statusColors = {
    'New': 'blue',
    'In Progress': 'orange',
    'Completed': 'green',
    'Cancelled': 'red',
  };

  const statusColor = statusColors[job.status] || 'muted';
  const timeDisplay = job.timeAgo || new Date(job.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (variant === 'compact') {
    return (
      <div className={`${styles.card} ${styles.compactCard}`}>
        <div className={styles.compactContent}>
          <div className={styles.left}>
            <h3 className={styles.compactTitle}>{job.customerSector} — {job.serviceType}</h3>
            <span className={styles.time}>{timeDisplay}</span>
          </div>
          <div className={styles.right}>
            <Badge variant={statusColor}>{job.status}</Badge>
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`${styles.card} ${styles[`border${statusColor}`]}`}>
      <div 
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className={styles.headerTop}>
          <h3 className={styles.sector}>{job.customerSector}</h3>
          <Badge variant={statusColor}>{job.status}</Badge>
        </div>
        <span className={styles.timeFull}>{timeDisplay}</span>
        
        <div className={styles.serviceRow}>
          <span className={styles.servicePill}>{job.serviceType}</span>
          <span className={styles.address}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.pinIcon}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            House 47, Street 3, {job.customerSector}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.metaInfo}>
            <p>Session ID: <span className={styles.metaValue}>{job.sessionId || job.id}</span></p>
            <p>Notes: <span className={styles.metaValue}>{job.notes || 'No notes available.'}</span></p>
          </div>
          
          {!readOnly && (
            <div className={styles.actions}>
              <button className={styles.completeBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Mark as Completed
              </button>
              <button className={styles.callBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Call
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
