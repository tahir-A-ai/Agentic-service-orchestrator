import { useState } from 'react';
import styles from './StatusToggle.module.css';

export default function StatusToggle() {
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <button
      className={[
        styles.toggle,
        isAvailable ? styles.available : styles.busy,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => setIsAvailable((v) => !v)}
      aria-pressed={isAvailable}
    >
      <div className={styles.slider}>
        <span className={styles.dot} />
      </div>
      <span className={styles.label}>
        {isAvailable ? 'Available' : 'Busy'}
      </span>
    </button>
  );
}
