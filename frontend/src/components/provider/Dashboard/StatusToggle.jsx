import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useProviderStats } from '../../../context/ProviderStatsContext';
import { toggleAvailability } from '../../../api/provider';
import { useToast } from '../../../context/ToastContext';
import styles from './StatusToggle.module.css';

export default function StatusToggle({ collapsed = false }) {
  const { providerProfile } = useAuth();
  const { stats, updateAvailabilityLocal } = useProviderStats();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const isAvailable = stats.is_available ?? true;
  const isBusy = stats.status === 'Busy' || stats.active_jobs > 0;

  const handleToggle = async () => {
    if (!providerProfile?.id || loading) return;
    const nextVal = !isAvailable;
    setLoading(true);
    try {
      if (updateAvailabilityLocal) updateAvailabilityLocal(nextVal);
      await toggleAvailability(providerProfile.id, nextVal);
      showToast(`Status: ${nextVal ? 'Available' : 'Offline'}`, 'success');
    } catch (err) {
      if (updateAvailabilityLocal) updateAvailabilityLocal(isAvailable); // revert
      showToast('Status update failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Visual state:
  // If toggled OFF: offline style (grey / switch left)
  // If toggled ON and Busy: busy style (orange / switch right)
  // If toggled ON and Free: available style (green / switch right)
  const statusClass = !isAvailable
    ? styles.offline
    : (isBusy ? styles.busy : styles.available);

  const statusLabel = !isAvailable
    ? 'Offline'
    : (isBusy ? 'Busy' : 'Available');

  return (
    <button
      className={[
        styles.toggle,
        statusClass,
        collapsed ? styles.collapsedToggle : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleToggle}
      disabled={loading}
      aria-pressed={isAvailable}
      aria-label={`Status: ${statusLabel}`}
      title={`Status: ${statusLabel} (${!isAvailable ? 'Click to go Available' : (isBusy ? 'In a job (Busy)' : 'Click to go Offline')})`}
    >
      <div className={styles.slider}>
        <span className={styles.dot} />
      </div>
      {!collapsed && (
        <span className={styles.label}>
          {statusLabel}
        </span>
      )}
    </button>
  );
}
