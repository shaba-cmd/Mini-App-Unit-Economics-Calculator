import { useId } from 'react';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: '₽' | '%' | 'шт.';
  hint?: string;
  error?: string;
  placeholder?: string;
  /** Целые числа (для количества штук) */
  integer?: boolean;
  children?: React.ReactNode;
}

/** Числовое поле: десятичная клавиатура на телефоне, суффикс единиц, ошибка под полем. */
export function NumberField({ label, value, onChange, suffix, hint, error, placeholder, integer, children }: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="field-input">
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          placeholder={placeholder ?? '0'}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
