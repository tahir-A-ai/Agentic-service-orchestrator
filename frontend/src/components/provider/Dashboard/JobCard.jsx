import { useState } from 'react';
import Badge from '../../ui/Badge';
import { updateJobStatus } from '../../../api/provider';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import styles from './JobCard.module.css';

/**
 * Display a provider-dashboard job in compact or expandable form.
 *
 * @param {Object} job - Job data, including its status, service type, address, and session details.
 * @param {string} [variant='full'] - Display mode: `'compact'` for a read-only summary or `'full'` for expandable details and actions.
 * @param {boolean} [readOnly=false] - Whether to hide status action controls in the full display.
 * @param {function} onActionComplete - Callback invoked after a successful status update.
 */
export default function JobCard({ job, variant = 'full', readOnly = false, onActionComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { providerProfile } = useAuth();
  const { showToast } = useToast();

  const statusColors = {
    'Pending_Acceptance': 'blue',
    'In_Progress': 'orange',
    'Pending_Completion': 'gold',
    'Completed': 'green',
    'Cancelled': 'red',
  };

  // Distinguish customer-cancelled from provider-cancelled
  const getCancelledLabel = () => {
    if (job.status !== 'Cancelled') return null;
    return job.cancelled_by === 'customer' ? 'Cancelled by Customer' : 'Cancelled by Provider';
  };

  const statusLabels = {
    'Pending_Acceptance': 'New',
    'In_Progress': 'In Progress',
    'Pending_Completion': 'Awaiting Customer Review',
    'Completed': 'Completed',
    'Cancelled': getCancelledLabel() || 'Cancelled',
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

  // Full variant
  return (
    <div className={styles.card}>
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
                  <button 
                    className={styles.declineBtn} 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to cancel this active job?")) {
                        handleStatusChange('Cancelled');
                      }
                    }}
                    disabled={loading}
                  >
                    Cancel Job
                  </button>
                  <button className={styles.callBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    Call
                  </button>
                </>
              )}
              {job.status === 'Pending_Completion' && (
                <div className={styles.awaitingBox}>
                  <div className={styles.awaitingText}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.hourglassIcon}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                    <span>Kaam complete ho gaya hai — Customer review ka intezar hai.</span>
                  </div>
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
      )}
    </div>
  );
}
