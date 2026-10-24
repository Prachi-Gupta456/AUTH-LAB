import HomeCta from '@/components/HomeCta';

const FEATURES = [
  { icon: '🔐', title: 'Secure sessions', text: 'Short-lived access tokens, rotating refresh tokens and theft detection.' },
  { icon: '📱', title: 'Multi-device control', text: 'See every device you are logged in on and log out any of them remotely.' },
  { icon: '✉️', title: 'Email OTP', text: 'Verify your email, log in without a password, or reset a forgotten one.' },
  { icon: '💬', title: 'Phone OTP', text: 'Link your number and sign in with a code sent by SMS.' },
  { icon: '🛡️', title: 'Two-factor auth', text: 'Authenticator app codes with one-time backup codes for recovery.' },
  { icon: '🌐', title: 'Google & GitHub', text: 'Continue with a provider you already use. Accounts link by verified email.' },
  { icon: '📷', title: 'QR login', text: 'Scan a code with your phone to sign in on another screen.' },
  { icon: '🔗', title: 'Single sign-on', text: 'Use Auth Lab as the identity provider for your own apps.' },
  { icon: '📜', title: 'Audit & alerts', text: 'Activity history, account lockout and new-device email alerts.' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      {/* ---------- hero ---------- */}
      <section className="mb-16 text-center">
        <span className="mb-5 inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          Authentication, built from scratch
        </span>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Sign in <span className="text-indigo-400">safely</span>, everywhere
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-zinc-400">
          Auth Lab is a complete authentication system: passwords, one-time codes, two-factor,
          social login, QR login and single sign-on, all in one place.
        </p>
        <HomeCta />
      </section>

      {/* ---------- features ---------- */}
      <section>
        <h2 className="mb-6 text-center text-sm uppercase tracking-widest text-zinc-500">
          What is inside
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 text-center text-xs text-zinc-600">
        Built with Next.js, Express and MongoDB
      </footer>
    </main>
  );
}