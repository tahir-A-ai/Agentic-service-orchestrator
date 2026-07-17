import styles from './StepIndicator.module.css';

/**
 * Step progress indicator for wizard forms.
 *
 * @param {number} currentStep (0-indexed)
 * @param {string[]} steps — array of step labels
 */
export default function StepIndicator({ currentStep, steps }) {
  return (
    <div className={styles.wrapper}>
      {steps.map((label, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;

        return (
          <div key={label} className={styles.step}>
            <div className={styles.nodeWrapper}>
              <div
                className={[
                  styles.node,
                  isActive ? styles.active : '',
                  isCompleted ? styles.completed : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={[
                    styles.line,
                    isCompleted ? styles.lineCompleted : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}
            </div>
            <span
              className={[
                styles.label,
                isActive || isCompleted ? styles.labelActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
