import { mockProviderStats } from '../../../data/mockData';
import styles from './StatsRow.module.css';

export default function StatsRow() {
  const { activeJobs, completedJobs, rating } = mockProviderStats;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={[styles.icon, styles.greenIcon].join(' ')}>🔨</div>
        <div className={styles.info}>
          <span className={styles.label}>Active Jobs</span>
          <span className={[styles.value, styles.greenText].join(' ')}>{activeJobs}</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={[styles.icon, styles.blueIcon].join(' ')}>✅</div>
        <div className={styles.info}>
          <span className={styles.label}>Completed</span>
          <span className={[styles.value, styles.blueText].join(' ')}>{completedJobs}</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={[styles.icon, styles.goldIcon].join(' ')}>⭐</div>
        <div className={styles.info}>
          <span className={styles.label}>Rating</span>
          <span className={[styles.value, styles.goldText].join(' ')}>{rating}</span>
        </div>
      </div>
    </div>
  );
}
