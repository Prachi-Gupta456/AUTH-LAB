'use client';

// Add more countries here whenever you need them
const COUNTRIES = [
  { code: '+91', label: 'IN +91' },
  { code: '+1', label: 'US +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+61', label: 'AU +61' },
  { code: '+971', label: 'AE +971' },
];

// Joins dropdown + number into the E.164 string the backend expects
export const toE164 = (countryCode, number) => `${countryCode}${number.replace(/\D/g, '')}`;

export default function PhoneInput({ countryCode, number, onCountryChange, onNumberChange, disabled = false }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm text-zinc-400">Phone number</span>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={disabled}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm outline-none transition focus:border-indigo-500 disabled:opacity-50"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="9876543210"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ''))}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 disabled:opacity-50"
        />
      </div>
    </label>
  );
}