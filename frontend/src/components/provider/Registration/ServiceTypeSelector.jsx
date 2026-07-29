import { useState, useEffect, useRef } from 'react';
import { getServiceTypes } from '../../../api/stats';
import { getIconComponent } from '../../../constants/serviceIcons';
import styles from './ServiceTypeSelector.module.css';

/**
 * Searchable dropdown selector for service types.
 * Fetches available service types dynamically from the API and renders them
 * as rich option rows with icon, label, Urdu name, and description.
 * Scales gracefully from 2 to 50+ service types.
 */
export default function ServiceTypeSelector({ value, onChange }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  /* ── Fetch service types from backend ── */
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

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  /* ── Auto-focus search on open ── */
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  /* ── Filter services by search query ── */
  const filtered = services.filter((svc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      svc.label.toLowerCase().includes(q) ||
      (svc.label_urdu && svc.label_urdu.toLowerCase().includes(q)) ||
      (svc.description && svc.description.toLowerCase().includes(q)) ||
      (svc.key && svc.key.toLowerCase().includes(q))
    );
  });

  const selected = services.find((s) => s.key === value);

  /* ── Handle option select ── */
  const handleSelect = (key) => {
    onChange(key);
    setOpen(false);
    setSearch('');
  };

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  /* ── Loading State ── */
  if (loading) {
    return <div className={styles.status}>Loading services...</div>;
  }

  /* ── Error State ── */
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
    <div className={styles.wrapper} ref={wrapperRef} onKeyDown={handleKeyDown}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ''].filter(Boolean).join(' ')}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected ? (
          <>
            <span className={styles.triggerIcon} style={{ color: selected.theme_color }}>
              {(() => {
                const Icon = getIconComponent(selected.key);
                return <Icon size={22} color="currentColor" />;
              })()}
            </span>
            <span className={styles.triggerContent}>
              <span className={styles.triggerLabel}>{selected.label}</span>
              <span className={styles.triggerSub}>{selected.label_urdu}</span>
            </span>
          </>
        ) : (
          <span className={styles.triggerPlaceholder}>Select your service...</span>
        )}

        {/* Chevron */}
        <svg
          className={[styles.chevron, open ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div className={styles.dropdown} role="listbox">
          {/* Search */}
          {services.length > 3 && (
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Options */}
          <div className={styles.optionsList}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>No matching service found</div>
            ) : (
              filtered.map((svc) => {
                const Icon = getIconComponent(svc.key);
                const isSelected = value === svc.key;
                return (
                  <button
                    key={svc.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={[styles.option, isSelected ? styles.optionSelected : ''].filter(Boolean).join(' ')}
                    onClick={() => handleSelect(svc.key)}
                  >
                    <span className={styles.optionIcon} style={{ color: svc.theme_color }}>
                      <Icon size={20} color="currentColor" />
                    </span>
                    <span className={styles.optionContent}>
                      <span className={styles.optionLabel}>
                        {svc.label}
                        <span className={styles.optionUrdu}> — {svc.label_urdu}</span>
                      </span>
                      {svc.description && (
                        <span className={styles.optionDesc}>{svc.description}</span>
                      )}
                    </span>
                    {isSelected && (
                      <svg className={styles.checkMark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
