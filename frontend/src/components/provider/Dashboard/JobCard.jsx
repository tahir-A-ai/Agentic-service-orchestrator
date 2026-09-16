import { useState } from 'react';
import Badge from '../../ui/Badge';
import TrackingMapModal from '../../booking/TrackingMapModal';
import { updateJobStatus } from '../../../api/provider';
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
  const [isMapOpen, setIsMapOpen] = useState(false);
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
            <p>Customer: <span className={styles.metaValue}>{job.customer_name || 'Customer'}</span></p>
            {job.customer_phone && <p>Phone: <span className={styles.metaValue}>{job.customer_phone}</span></p>}
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
                  {job.customer_phone ? (
                    <a href={`tel:${job.customer_phone}`} className={styles.callBtn} title={`Call Customer: ${job.customer_phone}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      Call
                    </a>
                  ) : (
                    <button className={styles.callBtn} onClick={() => alert('Customer phone number is not available.')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      Call
                    </button>
                  )}

                  <button className={styles.mapBtn} onClick={() => setIsMapOpen(true)} title="View Customer Location & Route">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                    Map
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
                  {job.customer_phone ? (
                    <a href={`tel:${job.customer_phone}`} className={styles.callBtn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      Call
                    </a>
                  ) : (
                    <button className={styles.callBtn} onClick={() => alert('Customer phone number is not available.')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      Call
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live Map Modal for Provider */}
      <TrackingMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        provider={{
          name: providerProfile?.name || 'You',
          service_type: job.service_type,
          latitude: job.provider_lat || 33.6999,
          longitude: job.provider_lon || 73.1756,
          phone: job.provider_phone,
        }}
        customer={{
          name: job.customer_name || 'Customer',
          address: job.exact_address || 'Customer Location',
          latitude: 33.6425,
          longitude: 72.9841,
          phone: job.customer_phone,
        }}
        status={job.status}
        isProviderView={true}
      />
    </div>
  );
}

