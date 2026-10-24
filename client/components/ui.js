export function Card({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-zinc-400">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm text-zinc-400">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
      />
    </label>
  );
}

export function Button({ loading, children, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? 'Please wait...' : children}
    </button>
  );
}

// Backend ke zod errors [{field, message}] yahan dikhenge
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
      <p>{error.message}</p>
      {error.errors?.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-red-400">
          {error.errors.map((e, i) => (
            <li key={i}>
              {e.field}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Green success box (for "OTP sent", "Password updated" etc.)
export function InfoBox({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">
      {message}
    </div>
  );
}

// "Resend OTP in 42s" -> becomes a clickable button at 0
export function ResendButton({ seconds, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={seconds > 0}
      className="text-sm text-indigo-400 hover:underline disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline"
    >
      {seconds > 0 ? `Resend OTP in ${seconds}s` : 'Resend OTP'}
    </button>
  );
}


export const parseError = (err) =>
  err.response?.data || { message: err.message || 'Something went wrong' };