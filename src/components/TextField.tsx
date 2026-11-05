import { useId } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}

export function TextField({ label, value, onChange, hint, placeholder, maxLength }: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="field-input">
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
