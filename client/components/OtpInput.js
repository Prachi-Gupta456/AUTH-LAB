'use client';

import { useRef } from 'react';

export default function OtpInput({ value, onChange, length = 6, disabled = false }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const focus = (i) => refs.current[i]?.focus();

  const handleChange = (i, e) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1); // keep only the last typed digit
    if (!digit) return;
    const next = [...digits];
    next[i] = digit;
    onChange(next.join(''));
    if (i < length - 1) focus(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = '';          // box has a digit: clear it
      } else if (i > 0) {
        next[i - 1] = '';      // box empty: clear previous and go back
        focus(i - 1);
      }
      onChange(next.join(''));
    }
    if (e.key === 'ArrowLeft' && i > 0) focus(i - 1);
    if (e.key === 'ArrowRight' && i < length - 1) focus(i + 1);
  };

  // Paste "123456" anywhere: fill all boxes at once
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focus(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 text-center text-xl font-semibold outline-none transition focus:border-indigo-500 disabled:opacity-50"
        />
      ))}
    </div>
  );
}