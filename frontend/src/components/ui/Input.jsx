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
  onChange,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const filled = (value !== undefined && value !== '') || (rest.defaultValue !== undefined && rest.defaultValue !== '');
  const isFloating = focused || filled;

  const Tag = as === 'textarea' ? 'textarea' : 'input';

  return (
    <div
      className={[
        styles.wrapper,
        error ? styles.hasError : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix && <span className={styles.prefix}>{prefix}</span>}

      <div className={styles.fieldWrap}>
        <Tag
          id={id}
          className={[styles.field, as === 'textarea' ? styles.textarea : '']
            .filter(Boolean)
            .join(' ')}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=" "
          {...rest}
        />
        {label && (
          <label
            htmlFor={id}
            className={[styles.label, isFloating ? styles.floating : '']
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </label>
        )}
      </div>

      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
