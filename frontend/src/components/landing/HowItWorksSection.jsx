import styles from './HowItWorksSection.module.css';

export default function HowItWorksSection() {
  return (
    <section className={styles.howItWorks} id="how-it-works">
      <span className={styles.howLabel}>HOW IT WORKS</span>
      <h2 className={styles.howHeadline}>3 Steps Mein Service Book Karein</h2>

      <div className={styles.stepsRow}>
        {/* Step 1 */}
        <div className={styles.stepCard}>
          <div className={styles.stepTop}>
            <div className={styles.stepIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className={styles.stepNumber}>01</span>
          </div>
          <h3 className={styles.stepTitle}>Type Karein</h3>
          <p className={styles.stepDesc}>
            Roman Urdu mein apni zaroorat likhein. Koi form nahi, koi confusion nahi.
          </p>
        </div>

        {/* Step 2 */}
        <div className={styles.stepCard}>
          <div className={styles.stepTop}>
            <div className={[styles.stepIcon, styles.stepIconGreen].join(' ')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <span className={styles.stepNumber}>02</span>
          </div>
          <h3 className={styles.stepTitle}>AI Samjhega</h3>
          <p className={styles.stepDesc}>
            Hamara AI aapka request samjhega aur nearest providers dhundega.
          </p>
        </div>

        {/* Step 3 */}
        <div className={styles.stepCard}>
          <div className={styles.stepTop}>
            <div className={[styles.stepIcon, styles.stepIconGreen].join(' ')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span className={styles.stepNumber}>03</span>
          </div>
          <h3 className={styles.stepTitle}>Confirm Karein</h3>
          <p className={styles.stepDesc}>
            Provider approve karein, booking confirm — karigar aa raha hai!
          </p>
        </div>
      </div>
    </section>
  );
}
