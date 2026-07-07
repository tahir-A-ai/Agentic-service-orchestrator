import { useState } from 'react';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import styles from './JobCard.module.css';

/**
 * Card displaying a job in the provider dashboard.
 * Supports active and completed jobs (read-only by design).
 *
 * @param {Object} job
 */
export default function JobCard({ job }) {
  const statusColors = {
    'New': 'blue',
    'In Progress': 'orange',
    'Completed': 'green',
    'Cancelled': 'red',
  };

  const statusColor = statusColors[job.status] || 'muted';

  // Format time properly to match Figma if available, else fallback
  const timeDisplay = job.timeAgo || new Date(job.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <div className={styles.left}>
          <h3 className={styles.title}>{job.customerSector} — {job.serviceType}</h3>
          <span className={styles.time}>{timeDisplay}</span>
        </div>
        <div className={styles.right}>
          <Badge variant={statusColor}>{job.status}</Badge>
        </div>
      </div>
    </div>
  );
}
