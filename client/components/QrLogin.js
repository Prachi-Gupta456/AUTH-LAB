'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const POLL_MS = 2000;
const QR_TTL_SECONDS = 120; // must match the backend TTL
const MAX_AUTO_REFRESH = 5; // stop regenerating on a forgotten open tab

export default function QrLogin({ onSuccess }) {
  const { setSession } = useAuth();
  const [gen, setGen] = useState(0); // bump this number = "make a fresh QR"
  const [qr, setQr] = useState(null); // { qrDataUrl, qrPayload }
  const [status, setStatus] = useState('loading'); // loading | pending | scanned | rejected | expired | error
  const [deadline, setDeadline] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);
  const [copied, setCopied] = useState(false);

  const autoRefreshes = useRef(0);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess; // always call the latest callback without re-running the effect

  // ---- generate a QR, then poll its status until something final happens ----
  useEffect(() => {
    let cancelled = false;
    let timer;

    const run = async () => {
      setStatus('loading');
      setQr(null);

      let created;
      try {
        const { data } = await api.post('/qr/generate');
        created = data;
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }
      if (cancelled) return;

      setQr({ qrDataUrl: created.qrDataUrl, qrPayload: created.qrPayload });
      setStatus('pending');
      setDeadline(Date.now() + QR_TTL_SECONDS * 1000);

      const poll = async () => {
        if (cancelled) return;
        try {
          const { data } = await api.get(`/qr/status/${created.id}`, {
            headers: { 'x-qr-secret': created.pollSecret }, // secret in a header, never in the URL
          });
          if (cancelled) return;

          if (data.status === 'approved') {
            cancelled = true; // stop everything, we are done
            setSession(data); // { user, accessToken } (refresh cookie is already set)
            onSuccessRef.current();
            return;
          }

          if (['expired', 'rejected', 'consumed'].includes(data.status)) {
            setStatus(data.status === 'consumed' ? 'expired' : data.status);
            return; // final state, stop polling
          }

          setStatus(data.status); // pending or scanned
        } catch (err) {
          if (cancelled) return;
          // 404 = this QR is gone. Anything else (network blip, 429) = just try again.
          if (err.response?.status === 404) {
            setStatus('expired');
            return;
          }
        }
        timer = setTimeout(poll, POLL_MS); // next poll only AFTER this one finished
      };

      poll();
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gen, setSession]);

  // ---- countdown (cosmetic: the server is the real authority on expiry) ----
  useEffect(() => {
    if (!deadline || !['pending', 'scanned'].includes(status)) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, status]);

  // ---- auto-refresh when the QR expires ----
  useEffect(() => {
    if (status === 'expired' && autoRefreshes.current < MAX_AUTO_REFRESH) {
      autoRefreshes.current += 1;
      setGen((g) => g + 1);
    }
  }, [status]);

  const manualRefresh = () => {
    autoRefreshes.current = 0;
    setGen((g) => g + 1);
  };

  const copyPayload = async () => {
    await navigator.clipboard.writeText(qr.qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="text-center">
      <div className="relative mx-auto mb-4 h-52 w-52">
        {/* White background on purpose: scanners need dark-on-light contrast */}
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.qrDataUrl}
            alt="Login QR code"
            className={`h-52 w-52 rounded-xl bg-white p-2 transition ${
              status === 'scanned' ? 'opacity-20 blur-sm' : ''
            }`}
          />
        )}

        {status === 'loading' && (
          <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
            Generating QR...
          </div>
        )}

        {status === 'scanned' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4">
            <span className="text-3xl">📱</span>
            <p className="text-sm font-medium text-emerald-300">Scanned!</p>
            <p className="text-xs text-zinc-400">Confirm the login on your phone</p>
          </div>
        )}

        {(status === 'rejected' || status === 'error' || (status === 'expired' && autoRefreshes.current >= MAX_AUTO_REFRESH)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4">
            <p className="text-sm text-zinc-300">
              {status === 'rejected' && 'Login was rejected on your phone.'}
              {status === 'error' && 'Could not create a QR code.'}
              {status === 'expired' && 'QR code expired.'}
            </p>
            <button
              onClick={manualRefresh}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium transition hover:bg-indigo-500"
            >
              Generate new QR
            </button>
          </div>
        )}
      </div>

      {status === 'pending' && (
        <p className="text-xs text-zinc-500">Refreshes in {mm}:{ss}</p>
      )}

      <ol className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-zinc-400">
        <li>1. Open this app on your phone (already logged in)</li>
        <li>2. Go to <span className="text-zinc-200">Scan QR</span></li>
        <li>3. Point the camera here and tap Approve</li>
      </ol>

      {/* Dev helper: lets you test on ONE computer, no phone camera needed */}
      {process.env.NODE_ENV !== 'production' && qr && (
        <button
          type="button"
          onClick={copyPayload}
          className="mt-4 text-xs text-zinc-500 underline hover:text-zinc-300"
        >
          {copied ? 'Copied ✓' : 'Dev: copy QR payload'}
        </button>
      )}
     
    </div>
  );
}