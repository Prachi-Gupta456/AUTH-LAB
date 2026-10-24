'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import { Field, ErrorBox, InfoBox, parseError } from '@/components/ui';

const primaryBtn =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';
const ghostBtn =
  'rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800 disabled:opacity-50';

export default function MfaCard() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState(null); // { enabled, backupCodesRemaining }
  const [view, setView] = useState('idle'); // idle | setup | backup | disable | regen
  const [setupData, setSetupData] = useState(null); // { qrDataUrl, manualKey }
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/mfa/status');
      setStatus(data);
    } catch (err) {
      setError(parseError(err));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const resetForm = () => {
    setCode('');
    setPassword('');
    setError(null);
    setSetupData(null);
  };

  const goIdle = () => {
    resetForm();
    setView('idle');
  };

  // Small wrapper so every action has the same loading + error handling
  const run = async (fn) => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(parseError(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // ---- actions ----

  const startSetup = () =>
    run(async () => {
      const { data } = await api.post('/mfa/setup');
      setSetupData({ qrDataUrl: data.qrDataUrl, manualKey: data.manualKey });
      setView('setup');
    });

  const confirmSetup = (e) => {
    e.preventDefault();
    run(async () => {
      const { data } = await api.post('/mfa/verify-setup', { code });
      setBackupCodes(data.backupCodes);
      setSaved(false);
      setCode('');
      setSetupData(null);
      setView('backup');
      await refreshUser(); // user.mfa.enabled becomes true everywhere
      await loadStatus();
    });
  };

  const regenerate = (e) => {
    e.preventDefault();
    run(async () => {
      const { data } = await api.post('/mfa/backup-codes', { code });
      setBackupCodes(data.backupCodes);
      setSaved(false);
      setCode('');
      setView('backup');
      await loadStatus();
    });
  };

  const disable = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/mfa/disable', { password, code });
      resetForm();
      setView('idle');
      setInfo('Two-factor authentication has been disabled.');
      await refreshUser();
      await loadStatus();
    });
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const text = `Auth Lab backup codes\nEach code works once.\n\n${backupCodes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auth-lab-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeBackup = () => {
    setBackupCodes([]); // wipe them from memory
    setView('idle');
  };

  // ---- render ----

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Two-factor authentication</h2>
        <p className="text-sm text-zinc-400">Protect your account with an authenticator app</p>
      </div>

      <ErrorBox error={error} />
      <InfoBox message={info} />

      {/* ---------- idle ---------- */}
      {view === 'idle' && status && !status.enabled && (
        <button onClick={startSetup} disabled={loading} className={`${primaryBtn} w-full`}>
          {loading ? 'Please wait...' : 'Enable 2FA'}
        </button>
      )}

      {view === 'idle' && status?.enabled && (
        <div>
          <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/20 p-4">
            <p className="text-sm font-medium text-emerald-300">2FA is ON</p>
            <p className={`text-xs ${status.backupCodesRemaining <= 2 ? 'text-amber-400' : 'text-zinc-400'}`}>
              {status.backupCodesRemaining} backup codes remaining
              {status.backupCodesRemaining <= 2 && ' · generate new ones soon'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => { resetForm(); setView('regen'); }} className={`${ghostBtn} flex-1`}>
              New backup codes
            </button>
            <button
              onClick={() => { resetForm(); setView('disable'); }}
              className="flex-1 rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/40"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      )}

      {/* ---------- setup: scan + confirm ---------- */}
      {view === 'setup' && setupData && (
        <form onSubmit={confirmSetup}>
          <p className="mb-3 text-sm text-zinc-400">
            1. Scan this QR with Google Authenticator, Authy or any TOTP app.
          </p>
          <div className="mb-3 flex justify-center">
            {/* White background on purpose: QR scanners need dark-on-light contrast */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qrDataUrl} alt="2FA QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
          </div>
          <p className="mb-1 text-center text-xs text-zinc-500">Can&apos;t scan? Enter this key manually:</p>
          <p className="mb-5 break-all text-center font-mono text-sm text-emerald-400">
            {setupData.manualKey}
          </p>

          <p className="mb-3 text-sm text-zinc-400">2. Enter the 6-digit code shown in the app.</p>
          <div className="mb-4">
            <OtpInput value={code} onChange={setCode} disabled={loading} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading || code.length !== 6} className={`${primaryBtn} flex-1`}>
              {loading ? 'Please wait...' : 'Verify & enable'}
            </button>
            <button type="button" onClick={goIdle} className={ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* ---------- backup codes (shown ONCE) ---------- */}
      {view === 'backup' && (
        <div>
          <div className="mb-4 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-300">
            Save these codes now. They are shown only once. Each code works a single time.
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-black p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="mb-4 flex gap-2">
            <button onClick={copyCodes} className={`${ghostBtn} flex-1`}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button onClick={downloadCodes} className={`${ghostBtn} flex-1`}>Download .txt</button>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="h-4 w-4 accent-indigo-500"
            />
            I have saved my backup codes
          </label>
          <button onClick={closeBackup} disabled={!saved} className={`${primaryBtn} w-full`}>
            Done
          </button>
        </div>
      )}

      {/* ---------- regenerate backup codes ---------- */}
      {view === 'regen' && (
        <form onSubmit={regenerate}>
          <p className="mb-3 text-sm text-zinc-400">
            Old backup codes will stop working. Confirm with a code from your app.
          </p>
          <Field
            label="Authenticator or backup code"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={loading || code.trim().length < 6} className={`${primaryBtn} flex-1`}>
              {loading ? 'Please wait...' : 'Generate new codes'}
            </button>
            <button type="button" onClick={goIdle} className={ghostBtn}>Cancel</button>
          </div>
        </form>
      )}

      {/* ---------- disable ---------- */}
      {view === 'disable' && (
        <form onSubmit={disable}>
          <p className="mb-3 text-sm text-zinc-400">
            To turn off 2FA, confirm your password and a code.
          </p>
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            label="Authenticator or backup code"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !password || code.trim().length < 6}
              className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Please wait...' : 'Disable 2FA'}
            </button>
            <button type="button" onClick={goIdle} className={ghostBtn}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}