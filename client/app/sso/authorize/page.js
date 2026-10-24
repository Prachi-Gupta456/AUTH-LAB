'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, ErrorBox, parseError } from '@/components/ui';

// The only query params the backend understands. Anything else is dropped.
const FIELDS = [
  'client_id', 'redirect_uri', 'response_type', 'scope',
  'state', 'code_challenge', 'code_challenge_method', 'nonce',
];

const SCOPE_INFO = {
  openid: { icon: '🪪', text: 'Know who you are (your Auth Lab ID)' },
  profile: { icon: '👤', text: 'See your name' },
  email: { icon: '✉️', text: 'See your email address and whether it is verified' },
};

export default function AuthorizePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [info, setInfo] = useState(null); // { client, scopes, consented }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const paramsRef = useRef(null); // the authorize request, read once from the URL
  const started = useRef(false); // guards against React StrictMode running the effect twice

  // Backend gives us the final URL. Leaving the page = full navigation to the client app.
  const go = (url) => window.location.assign(url);

  const decide = async (approve) => {
    setBusy(true);
    setError(null);
    try {
      // We re-send the whole request: the backend re-validates everything and never trusts us
      const { data } = await api.post('/sso/authorize/decision', { ...paramsRef.current, approve });
      go(data.redirectTo);
    } catch (err) {
      setError(parseError(err));
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }

    if (started.current) return;
    started.current = true;

    const q = new URLSearchParams(window.location.search);
    const params = {};
    for (const f of FIELDS) if (q.get(f)) params[f] = q.get(f);
    paramsRef.current = params;

    (async () => {
      try {
        const { data } = await api.get('/sso/authorize/validate', { params });

        // A "redirectable" error: the client app must hear about it (?error=...&state=...)
        if (data.redirectTo) return go(data.redirectTo);

        setInfo(data);
        if (data.consented) await decide(true); // already allowed before: silent SSO
      } catch (err) {
        setError(parseError(err)); // fatal: shown HERE, never redirected
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  // ---------- fatal error ----------
  if (error && !info) {
    return (
      <Card title="Cannot continue 🚫" subtitle="This sign-in request is not valid">
        <ErrorBox error={error} />
        <p className="mb-4 text-xs text-zinc-500">
          For your safety we did not send you back to the app, because we could not trust the
          request.
        </p>
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">
          Back to dashboard
        </Link>
      </Card>
    );
  }

  // ---------- loading / silent approval ----------
  if (authLoading || !user || !info || info.consented) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        {info?.consented ? `Signing you in to ${info.client.name}...` : 'Checking request...'}
      </div>
    );
  }

  // ---------- consent screen ----------
  return (
    <Card title={`${info.client.name} wants access`} subtitle={`Signed in as ${user.email}`}>
      <ErrorBox error={error} />

      <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <p className="mb-3 text-sm text-zinc-400">This app will be able to:</p>
        <ul className="space-y-2">
          {info.scopes.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm">
              <span>{SCOPE_INFO[s]?.icon || '•'}</span>
              <span>{SCOPE_INFO[s]?.text || s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Anyone can register an app named "Google". The host is the part that cannot be faked. */}
      <div className="mb-4 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-300">
        You will be sent to <b className="font-mono">{info.client.redirectHost}</b>. Only continue
        if you trust this app.
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => decide(false)}
          disabled={busy}
          className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800 disabled:opacity-50"
        >
          Deny
        </button>
        <button
          onClick={() => decide(true)}
          disabled={busy}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Please wait...' : 'Allow'}
        </button>
      </div>
    </Card>
  );
}