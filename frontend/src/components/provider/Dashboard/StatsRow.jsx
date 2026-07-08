import { useState, useEffect } from 'react';
import { getProviderStats } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import styles from './StatsRow.module.css';

export default function StatsRow() {
  const { providerProfile } = useAuth();
  const [stats, setStats] = useState({ active_jobs: 0, completed_jobs: 0, rating: 0.0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerProfile?.id) { setLoading(false); return; }
    let cancelled = false;
    getProviderStats(providerProfile.id)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [providerProfile?.id]);

  const displayStats = {
    activeJobs: stats.active_jobs,
    completedJobs: stats.completed_jobs,
    rating: stats.rating?.toFixed(1) || '0.0',
  };

  return (
    <div className={styles.grid}>
      <div className={[styles.card, styles.greenCard].join(' ')}>
        <span className={[styles.value, styles.greenText].join(' ')}>
          {loading ? '—' : displayStats.activeJobs}
        </span>
        <span className={styles.label}>Active Jobs</span>
      </div>

      <div className={[styles.card, styles.blueCard].join(' ')}>
        <span className={[styles.value, styles.blueText].join(' ')}>
          {loading ? '—' : displayStats.completedJobs}
        </span>
        <span className={styles.label}>Completed</span>
      </div>

      <div className={[styles.card, styles.goldCard].join(' ')}>
        <span className={[styles.value, styles.goldText].join(' ')}>
          {loading ? '—' : displayStats.rating} <span className={styles.starIcon}>⭐</span>
        </span>
        <span className={styles.label}>Rating</span>
      </div>
    </div>
  );
}
