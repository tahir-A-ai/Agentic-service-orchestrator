import { useState } from 'react';
import styles from './Input.module.css';

/**
 * Floating-label input component.
 *
 * @param {string} label
 * @param {string} error
 * @param {string} prefix — locked prefix like "+92"
 * @param {'input'|'textarea'} as
 */
export default function Input({
  label,
  error,
  prefix,
  as = 'input',
  id,
  className = '',
  value,
  defaultValue,
  onChange,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const isControlled = value !== undefined;
  
  // To handle uncontrolled inputs effectively
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  
  const currentValue = isControlled ? value : internalValue;
  
  const handleChange = (e) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    if (onChange) {
      onChange(e);
    }
  };

  const lifted = focused || (currentValue !== undefined && currentValue !== null && String(currentValue).length > 0);
  const Tag = as === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {prefix && <span className={styles.prefix}>{prefix}</span>}

      <div className={styles.fieldWrap}>
        <div className={[
          styles.inputContainer,
          error ? styles.inputError : '',
          focused ? styles.inputFocused : ''
        ].filter(Boolean).join(' ')}>
          <Tag
            id={id}
            className={[
              styles.input,
              as === 'textarea' ? styles.textarea : '',
              lifted ? styles.inputLifted : ''
            ].filter(Boolean).join(' ')}
            value={currentValue}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          />
          {label && (
            <label
              htmlFor={id}
              className={[
                styles.floatLabel,
                lifted ? styles.floatLabelLifted : ''
              ].filter(Boolean).join(' ')}
            >
              {label}
            </label>
          )}
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </div>
  );
}
