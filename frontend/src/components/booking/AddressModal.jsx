import { useState } from 'react';
import styles from './AddressModal.module.css';

export default function AddressModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    onSubmit({ exactAddress: address, customerNotes: notes });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Complete Your Booking</h2>
          <p>Provider ko dhundne ke liye apna exact address aur koi zaruri details dein.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.formBody}>
          <div className={styles.field}>
            <label className={styles.label}>Exact Address <span className={styles.asterisk}>*</span></label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. House 12, Street 4, G-13/1"
                required
                className={styles.inputWithIcon}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Notes for Provider</label>
              <span className={styles.optionalText}>Optional</span>
            </div>
            <div className={styles.textareaWrapper}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. AC cooling nahi kar raha..."
                rows="4"
                maxLength={300}
              />
              <span className={styles.charCount}>{notes.length}/300</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={isSubmitting} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !address.trim()} className={styles.submitBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
