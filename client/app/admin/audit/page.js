'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { can } from '@/lib/roles';
import { useAuth } from '@/context/AuthContext';
import { EVENTS, eventLabel, toneOf } from '@/lib/auditLabels';
import { ErrorBox, parseError } from '@/components/ui';

const smallBtn =
  'rounded-lg border border-zinc-700 px-2.5 py-1 text-xs transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

// `data` is small, secret-free JSON. Show it as a compact one-liner.
const compact = (d) => (d && Object.keys(d).length ? JSON.stringify(d) : '');

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [filters, setFilters] = useState({ userId: '', event: '' });
  const [ready, setReady] = useState(false); // true once ?userId= is read from the URL
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  // Arriving from the "Logs" button in the users table: ?userId=...
  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get('userId') || '';
    setFilters((f) => ({ ...f, userId }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login?next=/admin/audit');
    else if (!can(user.role, 'audit:read')) router.replace(can(user.role, 'users:read') ? '/admin' : '/dashboard');
  }, [authLoading, user, router]);

  const allowed = Boolean(user && can(user.role, 'audit:read'));

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const { data } = await api.get('/admin/audit', {
        params: {
          page,
          limit: 20,
          userId: filters.userId || undefined,
          event: filters.event || undefined,
        },
      });
      if (id !== latest.current) return;
      setData(data);
      setError(null);
    } catch (err) {
      if (id === latest.current) setError(parseError(err));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    if (allowed && ready) load();
  }, [allowed, ready, load]);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  if (authLoading || !allowed) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading...</div>;
  }

  const hasFilters = filters.userId || filters.event;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit log 📜</h1>
        <Link href="/admin" className="text-sm text-zinc-400 hover:underline">Back to users</Link>
      </div>

      <ErrorBox error={error} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={filters.event}
            onChange={(e) => setFilter({ event: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="">All events</option>
            {Object.keys(EVENTS).map((e) => (
              <option key={e} value={e}>{eventLabel(e)}</option>
            ))}
          </select>

          {filters.userId && (
            <span className="flex items-center gap-2 rounded-full bg-indigo-950 px-3 py-1 text-xs text-indigo-300">
              User: <span className="font-mono">{filters.userId.slice(-6)}</span>
              <button onClick={() => setFilter({ userId: '' })} aria-label="Clear user filter">✕</button>
            </span>
          )}

          {hasFilters && (
            <button onClick={() => setFilter({ userId: '', event: '' })} className="text-xs text-zinc-400 hover:underline">
              Clear all
            </button>
          )}
          <p className="ml-auto text-xs text-zinc-500">{data ? `${data.total} events` : ''}</p>
        </div>

        <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-3 pr-3">Event</th>
                <th className="pb-3 pr-3">User</th>
                <th className="pb-3 pr-3">IP</th>
                <th className="pb-3 pr-3">Details</th>
                <th className="pb-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data?.items.map((a) => (
                <tr key={a._id} className="align-top">
                  <td className="py-3 pr-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${toneOf(a.event)}`}>
                      {eventLabel(a.event)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-zinc-400">{a.user?.email || '-'}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-zinc-500">{a.ip || '-'}</td>
                  <td className="max-w-[260px] break-all py-3 pr-3 font-mono text-[11px] text-zinc-600">
                    {compact(a.data)}
                  </td>
                  <td className="whitespace-nowrap py-3 text-xs text-zinc-500" title={new Date(a.createdAt).toLocaleString()}>
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.items.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No events match.</p>}

        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className={smallBtn}>← Prev</button>
            <span className="text-xs text-zinc-500">Page {data.page} of {data.pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages} className={smallBtn}>Next →</button>
          </div>
        )}
      </section>
    </div>
  );
}