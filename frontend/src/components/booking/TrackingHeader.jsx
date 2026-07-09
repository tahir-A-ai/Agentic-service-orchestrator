import React from 'react';
import styles from './TrackingHeader.module.css';

export default function TrackingHeader({ status }) {
  const isWaiting = status === 'Pending_Acceptance';
  const isInProgress = status === 'In_Progress';
  const isCompleted = status === 'Completed';

  // Determine active step index
  let activeStep = 1; // Confirmed is always step 1
  if (isInProgress) activeStep = 2;
  if (isCompleted) activeStep = 3;

  return (
    <div className={styles.container}>
      {/* Circle Animation */}
      <div className={styles.animationContainer}>
        <div className={`${styles.circleOuter} ${isWaiting ? styles.yellowPulse : styles.greenStatic}`}>
          {isWaiting ? (
            // Spinner effect class on the SVG or border
            <svg className={styles.spinner} viewBox="0 0 50 50">
              <circle className={styles.spinnerPath} cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
            </svg>
          ) : (
            <svg className={styles.solidCircle} viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
            </svg>
          )}
          
          <div className={styles.iconInner}>
            {isWaiting ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Title & Subtitle */}
      <h2 className={`${styles.title} ${isWaiting ? styles.textYellow : styles.textGreen}`}>
        {isWaiting ? 'Waiting for Karigar to accept...' : 'Karigar is on the way!'}
      </h2>
      <p className={styles.subtitle}>
        {isWaiting 
          ? 'Aapki request providers ko bhej di gayi hai. Thodi der mein response aayega.' 
          : 'Provider ne booking accept kar li — woh raaste mein hai. Tayar rahein!'}
      </p>

      {/* Stepper */}
      <div className={styles.stepper}>
        <div className={styles.step}>
          <div className={`${styles.stepDot} ${activeStep >= 1 ? styles.dotActive : styles.dotInactive}`} />
          <span className={`${styles.stepLabel} ${activeStep >= 1 ? styles.labelActive : styles.labelInactive}`}>Confirmed</span>
        </div>
        <div className={`${styles.line} ${activeStep >= 2 ? styles.lineActive : styles.lineInactive}`} />
        <div className={styles.step}>
          <div className={`${styles.stepDot} ${activeStep >= 2 ? styles.dotActive : styles.dotInactive}`} />
          <span className={`${styles.stepLabel} ${activeStep >= 2 ? styles.labelActive : styles.labelInactive}`}>On the Way</span>
        </div>
        <div className={`${styles.line} ${activeStep >= 3 ? styles.lineActive : styles.lineInactive}`} />
        <div className={styles.step}>
          <div className={`${styles.stepDot} ${activeStep >= 3 ? styles.dotActive : styles.dotInactive}`} />
          <span className={`${styles.stepLabel} ${activeStep >= 3 ? styles.labelActive : styles.labelInactive}`}>Completed</span>
        </div>
      </div>
    </div>
  );
}
