import { useState, useEffect } from 'react';
import { getServiceTypes } from '../../../api/stats';
import { getIconComponent } from '../../../constants/serviceIcons';
import styles from './ServiceTypeSelector.module.css';

/**
 * Service type cards for provider registration step 2.
 * Fetches available service types dynamically from the API.
 */
export default function ServiceTypeSelector({ value, onChange }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = () => {
    setLoading(true);
    setError(null);
    getServiceTypes()
      .then((data) => {
        if (data?.service_types && data.service_types.length > 0) {
          setServices(data.service_types);
        } else {
          setError('No services found. Please contact support.');
        }
      })
      .catch((err) => {
        console.error('Failed to fetch service types:', err);
        setError(err.message || 'Could not connect to server. Is the backend running?');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  if (loading) {
    return <div className={styles.status}>Loading services...</div>;
  }

  if (error) {
    return (
      <div className={styles.status}>
        <span className={styles.errorText}>{error}</span>
        <button type="button" className={styles.retryBtn} onClick={fetchServices}>
          Retry
        </button>
      </div>
    );
  }

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
