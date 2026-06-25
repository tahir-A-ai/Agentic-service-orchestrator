import styles from './ServiceTypeSelector.module.css';

/**
 * Three large icon cards for selecting a service type during registration.
 *
 * @param {string} value
 * @param {function} onChange
 */
export default function ServiceTypeSelector({ value, onChange }) {
  const services = [
    { id: 'Plumber', icon: '🔧', label: 'Plumber' },
    { id: 'Electrician', icon: '⚡', label: 'Electrician' },
    { id: 'AC Technician', icon: '❄️', label: 'AC Technician' },
  ];

  return (
    <div className={styles.grid}>
      {services.map((svc) => (
        <button
          key={svc.id}
          type="button"
          className={[
            styles.card,
            value === svc.id ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(svc.id)}
        >
          <span className={styles.icon}>{svc.icon}</span>
          <span className={styles.label}>{svc.label}</span>
        </button>
      ))}
    </div>
  );
}
