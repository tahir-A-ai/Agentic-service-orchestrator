import { useState } from 'react';
import Badge from '../../ui/Badge';
import { updateJobStatus } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import styles from './JobCard.module.css';

/**
 * Card displaying a job in the provider dashboard.
 *
 * @param {Object} job
 * @param {string} variant - 'compact' (read-only list) or 'full' (expandable with actions)
 * @param {boolean} readOnly - true for completed jobs in full variant
 * @param {function} onActionComplete - callback to refresh jobs
 */
export default function JobCard({ job, variant = 'full', readOnly = false, onActionComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { providerProfile } = useAuth();
  const { showToast } = useToast();

  const statusColors = {
    'Pending_Acceptance': 'blue',
    'In_Progress': 'orange',
    'Completed': 'green',
    'Cancelled': 'red',
  };

  const statusLabels = {
    'Pending_Acceptance': 'New',
    'In_Progress': 'In Progress',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled',
  };

  const statusColor = statusColors[job.status] || 'muted';
  const timeDisplay = new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const address = job.exact_address || 'Address not provided';
  const sector = address.split(',').pop().trim() || 'Location';

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      await updateJobStatus(providerProfile.id, job.session_id, newStatus);
      showToast('Status updated', 'success');
      if (onActionComplete) onActionComplete();
    } catch (err) {
      showToast('Status update failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`${styles.card} ${styles.compactCard}`}>
        <div className={styles.compactContent}>
          <div className={styles.left}>
            <h3 className={styles.compactTitle}>{sector} — {job.service_type}</h3>
            <span className={styles.time}>{timeDisplay}</span>
          </div>
          <div className={styles.right}>
            <Badge variant={statusColor}>{statusLabels[job.status]}</Badge>
          </div>
        </div>
      </div>
    );
  }

  const borderClass = job.status === 'Completed' ? '' : (styles[`border${statusColor}`] || '');

  // Full variant
  return (
    <div className={`${styles.card} ${borderClass}`.trim()}>
      <div 
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className={styles.headerTop}>
          <h3 className={styles.sector}>{sector}</h3>
          <Badge variant={statusColor}>{statusLabels[job.status]}</Badge>
        </div>
        <span className={styles.timeFull}>{timeDisplay}</span>
        
        <div className={styles.serviceRow}>
          <span className={styles.servicePill}>{job.service_type}</span>
          <span className={styles.address}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.pinIcon}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {address}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.metaInfo}>
            <p>Session ID: <span className={styles.metaValue}>{job.session_id}</span></p>
            <p>Notes: <span className={styles.metaValue}>{job.customer_notes || 'No notes available.'}</span></p>
          </div>
          
          {!readOnly && (
            <div className={styles.actions}>
              {job.status === 'Pending_Acceptance' && (
                <>
                  <button 
                    className={styles.acceptBtn} 
                    onClick={() => handleStatusChange('In_Progress')}
                    disabled={loading}
                  >
                    Accept Job
                  </button>
                  <button 
                    className={styles.declineBtn} 
                    onClick={() => handleStatusChange('Cancelled')}
                    disabled={loading}
                  >
                    Decline
                  </button>
                </>
              )}
              {job.status === 'In_Progress' && (
                <>
                  <button 
                    className={styles.completeBtn}
                    onClick={() => handleStatusChange('Completed')}
                    disabled={loading}
                  >
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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
