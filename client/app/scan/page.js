'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { timeAgo } from '@/lib/time';
import { useAuth } from '@/context/AuthContext';
import QrScanner from '@/components/QrScanner';
import { Card, ErrorBox, parseError } from '@/components/ui';

// Format made by the backend: "qrlogin:v1:<id>:<scanSecret>"
// Anything else (a wifi QR, a website QR...) is rejected before touching the API.
const parsePayload = (text) => {
  const parts = text.trim().split(':');
  if (parts.length !== 4 || parts[0] !== 'qrlogin' || parts[1] !== 'v1') return null;
  return { id: parts[2], secret: parts[3] };
};

const ICONS = { desktop: '💻', mobile: '📱', tablet: '📲' };

export default function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState('scan'); // scan | confirm | done
  const [request, setRequest] = useState(null); // device/ip info from /qr/scan
  const [creds, setCreds] = useState(null); // { id, secret } kept in memory only
  const [pasted, setPasted] = useState('');
  const [outcome, setOutcome] = useState(null); // 'approved' | 'rejected'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // Countdown on the confirm screen (cosmetic, the server enforces expiry)
  useEffect(() => {
    if (step !== 'confirm' || !request) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((new Date(request.expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, request]);

  // Step 1 -> 2: validate the payload, tell the backend "I scanned it"
  const handleScanned = async (text) => {
    const parsed = parsePayload(text);
    if (!parsed) {
      setError({ message: 'This is not a login QR code.' });
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/qr/scan', parsed);
      setCreds(parsed);
      setRequest(data.request);
      setStep('confirm');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> 3: approve or reject
  const decide = async (action) => {
    setError(null);
    setLoading(true);
    try {
      await api.post(`/qr/${action}`, creds);
      setOutcome(action === 'approve' ? 'approved' : 'rejected');
      setCreds(null); // secret is no longer needed, drop it
      setStep('done');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('scan');
    setRequest(null);
    setCreds(null);
    setPasted('');
    setError(null);
  };

  if (authLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading...</div>;
  }

  // ---------- DONE ----------
  if (step === 'done') {
    return (
      <Card
        title={outcome === 'approved' ? 'Login approved ✅' : 'Login rejected 🚫'}
        subtitle={
          outcome === 'approved'
            ? 'The other device is being signed in now.'
            : 'The other device was not signed in.'
        }
      >
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Scan another
          </button>
          <Link
            href="/dashboard"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium transition hover:bg-indigo-500"
          >
            Dashboard
          </Link>
        </div>
      </Card>
    );
  }

  // ---------- CONFIRM ----------
  if (step === 'confirm' && request) {
    return (
      <Card title="Approve this login? 🔐" subtitle="A device is asking to sign in to your account">
        <ErrorBox error={error} />

        <div className="mb-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <span className="text-3xl">{ICONS[request.device?.deviceType] || '💻'}</span>
          <div>
            <p className="text-sm font-medium">
              {request.device?.browser} on {request.device?.os}
            </p>
            <p className="text-xs text-zinc-500">IP {request.ip}</p>
            <p className="text-xs text-zinc-600">Requested {timeAgo(request.requestedAt)}</p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-300">
          Only approve if <b>you</b> just opened this login page yourself. If someone sent you
          this QR code, or you do not recognize the device, tap Reject.
        </div>

        <p className="mb-4 text-center text-xs text-zinc-500">
          {secondsLeft > 0 ? `Expires in ${secondsLeft}s` : 'This request has expired'}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => decide('reject')}
            disabled={loading}
            className="flex-1 rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => decide('approve')}
            disabled={loading || secondsLeft === 0}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Please wait...' : 'Approve'}
          </button>
        </div>
      </Card>
    );
  }

  // ---------- SCAN ----------
  return (
    <Card title="Scan QR 📷" subtitle="Scan the QR code shown on the login screen">
      <ErrorBox error={error} />

      <QrScanner onResult={handleScanned} onError={(message) => setError({ message })} />

      <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        or paste the code
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleScanned(pasted);
        }}
      >
        <input
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="qrlogin:v1:..."
          autoComplete="off"
          className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none transition focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !pasted.trim()}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Please wait...' : 'Continue'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm">
        <Link href="/dashboard" className="text-zinc-400 hover:underline">Back to dashboard</Link>
      </p>
    </Card>
  );
}