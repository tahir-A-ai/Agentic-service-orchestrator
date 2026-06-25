import { useState } from 'react';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import styles from './JobCard.module.css';

/**
 * Card displaying a job in the provider dashboard.
 * Supports active and completed jobs.
 *
 * @param {Object} job
 * @param {boolean} readOnly — true for completed jobs
 */
export default function JobCard({ job, readOnly = false }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    'New': 'blue',
    'In Progress': 'orange',
    'Completed': 'green',
    'Cancelled': 'red',
  };

  const statusColor = statusColors[job.status] || 'muted';

  return (
    <div className={[styles.card, styles[`border${statusColor}`]].filter(Boolean).join(' ')}>
      <div 
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className={styles.headerLeft}>
          <h3 className={styles.sector}>{job.customerSector}</h3>
          <span className={styles.time}>
            {new Date(job.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className={styles.headerRight}>
          <Badge variant={statusColor}>{job.status}</Badge>
          <span className={[styles.chevron, expanded ? styles.expanded : ''].filter(Boolean).join(' ')}>
            ▼
          </span>
        </div>
      </div>

      <div className={styles.serviceRow}>
        <Badge variant="muted">{job.serviceType}</Badge>
      </div>

      {expanded && (
        <div className={styles.details}>
          <p className={styles.notes}><strong>Notes:</strong> {job.notes || 'No notes'}</p>
          
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Booking ID</span>
              <span className={styles.metaValue}>{job.sessionId || job.id}</span>
            </div>
            {readOnly && job.completedAt && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Completed At</span>
                <span className={styles.metaValue}>
                  {new Date(job.completedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            {readOnly && job.duration && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Duration</span>
                <span className={styles.metaValue}>{job.duration}</span>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className={styles.actions}>
              <Button variant="primary" size="sm">Mark as Completed</Button>
              <Button variant="ghost" size="sm" disabled>Call Customer</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
