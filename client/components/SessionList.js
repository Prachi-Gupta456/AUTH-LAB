'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { forceLogout } from '@/lib/api';
import { parseError } from '@/components/ui';
import { timeAgo } from '@/lib/time';

const ICONS = { desktop: '💻', mobile: '📱', tablet: '📲' };

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // which row is being revoked
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions);
      setError(null);
    } catch (err) {
      // 401s (revoked session etc.) are handled by the interceptor
      if (!silent) setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15s: if another device kills THIS session,
    // the next poll gets 401 SESSION_REVOKED and the interceptor logs us out
    const id = setInterval(() => load({ silent: true }), 15000);
    return () => clearInterval(id);
  }, [load]);

  const revokeOne = async (session) => {
    const msg = session.isCurrent
      ? 'This will log you out of THIS device. Continue?'
      : `Log out ${session.device?.browser} on ${session.device?.os}?`;
    if (!window.confirm(msg)) return;

    setBusyId(session.id);
    try {
      await api.delete(`/sessions/${session.id}`);
      if (session.isCurrent) return forceLogout();
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm('Log out from all other devices?')) return;
    try {
      await api.delete('/sessions'); // current session is kept by default
      await load();
    } catch (err) {
      setError(parseError(err));
    }
  };

  const revokeEverything = async () => {
    if (!window.confirm('Log out from ALL devices, including this one?')) return;
    try {
      await api.delete('/sessions', { params: { includeCurrent: true } });
      forceLogout();
    } catch (err) {
      setError(parseError(err));
    }
  };

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <p className="text-sm text-zinc-400">Jahan-jahan tu logged in hai</p>
        </div>
        <button
          onClick={() => load()}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {error.message}
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-zinc-500">Loading sessions...</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                s.isCurrent ? 'border-emerald-800 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ICONS[s.device?.deviceType] || '💻'}</span>
                <div>
                  <p className="text-sm font-medium">
                    {s.device?.browser} on {s.device?.os}
                    {s.isCurrent && (
                      <span className="ml-2 rounded-full bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        THIS DEVICE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    IP {s.ip} · Active {timeAgo(s.lastActiveAt)}
                  </p>
                  <p className="text-xs text-zinc-600">Signed in {timeAgo(s.createdAt)}</p>
                </div>
              </div>

              <button
                onClick={() => revokeOne(s)}
                disabled={busyId === s.id}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
              >
                {busyId === s.id ? '...' : s.isCurrent ? 'Log out' : 'Revoke'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={revokeOthers}
          disabled={otherCount === 0}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Log out other devices {otherCount > 0 && `(${otherCount})`}
        </button>
        <button
          onClick={revokeEverything}
          className="flex-1 rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/40"
        >
          Log out everywhere
        </button>
      </div>
    </section>
  );
}