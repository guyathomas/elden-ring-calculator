import { useState, useEffect, useRef } from 'react';

interface NumericInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value' | 'type'
  > {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Value to use when input is empty on blur. Defaults to min. */
  fallback?: number;
}

export function NumericInput({
  value,
  onValueChange,
  min = 1,
  max = 99,
  fallback,
  className,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const isFocusedRef = useRef(false);

  // Sync from parent when value changes externally (not while editing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    // Push valid values for live calculation updates, but don't clamp
    const parsed = parseInt(raw);
    if (!isNaN(parsed)) {
      onValueChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    const parsed = parseInt(localValue);
    if (isNaN(parsed) || localValue.trim() === '') {
      const resolved = fallback ?? min;
      setLocalValue(String(resolved));
      onValueChange(resolved);
    } else {
      const clamped = Math.max(min, Math.min(max, parsed));
      setLocalValue(String(clamped));
      onValueChange(clamped);
    }
    onBlur?.(e);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      min={min}
      max={max}
      className={className}
      {...props}
    />
  );
}
