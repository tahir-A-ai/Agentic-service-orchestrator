import { useState, useEffect } from 'react';
import { getServiceTypes } from '../../../api/stats';
import { getIconComponent } from '../../../constants/serviceIcons';
import styles from './ServiceTypeSelector.module.css';

/**
 * Three large icon cards for selecting a service type during registration.
 *
 * @param {string} value
 * @param {function} onChange
 */
export default function ServiceTypeSelector({ value, onChange }) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    getServiceTypes()
      .then((data) => {
        if (data?.service_types) setServices(data.service_types);
      })
      .catch((err) => console.error("Failed to fetch service types:", err));
  }, []);

  return (
    <div className={styles.grid}>
      {services.map((svc) => {
        const IconComponent = getIconComponent(svc.key);
        return (
          <button
            key={svc.key}
            type="button"
            className={[
              styles.card,
              value === svc.key ? styles.selected : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onChange(svc.key)}
          >
            <span className={styles.icon} style={{ color: svc.theme_color }}>
              <IconComponent size={32} color="currentColor" />
            </span>
            <span className={styles.label}>{svc.label}</span>
          </button>
        );
      })}
    </div>
  );
}
