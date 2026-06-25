import { useState, useCallback } from 'react';

/**
 * Multi-step form controller.
 *
 * @param {number} totalSteps
 * @returns {{ step, next, back, goTo, isFirst, isLast }}
 */
export default function useMultiStep(totalSteps) {
  const [step, setStep] = useState(0);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const goTo = useCallback(
    (s) => {
      if (s >= 0 && s < totalSteps) setStep(s);
    },
    [totalSteps],
  );

  return {
    step,
    next,
    back,
    goTo,
    isFirst: step === 0,
    isLast: step === totalSteps - 1,
  };
}
