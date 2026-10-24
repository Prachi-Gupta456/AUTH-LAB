'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { can } from '@/lib/roles';
import { timeAgo } from '@/lib/time';
import useDebounce from '@/lib/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { ErrorBox, InfoBox, parseError } from '@/components/ui';

const ROLE_BADGE = {
  admin: 'bg-indigo-950 text-indigo-300',
  moderator: 'bg-violet-950 text-violet-300',
  user: 'bg-zinc-800 text-zinc-400',
};

const smallBtn =
  'rounded-lg border border-zinc-700 px-2.5 py-1 text-xs transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); // { users, total, page, pages }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // e.g. "unlock:<id>"
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const latest = useRef(0); // id of the newest request

  // ---- access guard (UX only, the backend enforces the real rule) ----
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login?next=/admin');
    else if (!can(user.role, 'users:read')) router.replace('/dashboard');
  }, [authLoading, user, router]);

  const allowed = Boolean(user && can(user.role, 'users:read'));

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', {
        params: { page, limit: 10, q: debouncedSearch || undefined },
      });
      if (id !== latest.current) return; // a newer request exists: ignore this late answer
      setData(data);
      setError(null);
    } catch (err) {
      if (id === latest.current) setError(parseError(err));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  // One wrapper for every action: busy flag + error/info + refresh the table
  const act = async (key, fn, okMessage) => {
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(okMessage);
      await load();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(null);
    }
  };

  const unlock = (u) =>
    act(`unlock:${u.id}`, () => api.post(`/admin/users/${u.id}/unlock`), `${u.email} unlocked.`);

  const revoke = async (u) => {
    if (!window.confirm(`Log ${u.email} out of ALL devices?`)) return;
    setBusy(`revoke:${u.id}`);
    setError(null);
    setInfo(null);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/revoke-sessions`);
      setInfo(
        data.revoked === 0
          ? `${u.email} had no active sessions.`
          : `Revoked ${data.revoked} session(s) of ${u.email}.`
      );
      await load();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(null);
    }
  };

  const changeRole = (u, role) => {
    if (role === u.role) return;
    if (!window.confirm(`Change ${u.email} from "${u.role}" to "${role}"?`)) return;
    act(`role:${u.id}`, () => api.patch(`/admin/users/${u.id}/role`, { role }), `${u.email} is now ${role}.`);
  };

  if (authLoading || !allowed) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading...</div>;
  }

  const isAdmin = can(user.role, 'users:set_role');

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin panel 🛡️</h1>
        <div className="flex gap-4 text-sm">
          {can(user.role, 'audit:read') && (
            <Link href="/admin/audit" className="text-indigo-400 hover:underline">Audit log</Link>
          )}
          <Link href="/dashboard" className="text-zinc-400 hover:underline">Dashboard</Link>
        </div>
      </div>

      <ErrorBox error={error} />
      <InfoBox message={info} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // new search always starts from page 1
            }}
            placeholder="Search by name or email..."
            className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
          />
          <p className="shrink-0 text-xs text-zinc-500">{data ? `${data.total} users` : ''}</p>
        </div>

        {/* Wide table scrolls inside its own box, the page itself never scrolls sideways */}
        <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-3 pr-3">User</th>
                <th className="pb-3 pr-3">Role</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3 pr-3">Joined</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data?.users.map((u) => {
                const isSelf = u.id === user.id || u.id === user._id;
                // A moderator can't manage an admin (the backend refuses it too)
                const protectedRow = u.role === 'admin' && !isAdmin;

                return (
                  <tr key={u.id} className="align-middle">
                    <td className="py-3 pr-3">
                      <p className="font-medium">
                        {u.name}
                        {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                      </p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>

                    <td className="py-3 pr-3">
                      {isAdmin && !isSelf ? (
                        <select
                          value={u.role}
                          disabled={busy === `role:${u.id}`}
                          onChange={(e) => changeRole(u, e.target.value)}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                        >
                          <option value="user">user</option>
                          <option value="moderator">moderator</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                      )}
                    </td>

                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {u.locked && (
                          <span className="rounded-full bg-red-950 px-2 py-0.5 text-[10px] text-red-300">LOCKED</span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${u.isEmailVerified ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                            }`}
                        >
                          {u.isEmailVerified ? 'verified' : 'unverified'}
                        </span>
                        {u.mfaEnabled && (
                          <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-300">2FA</span>
                        )}
                        {u.providers.map((p) => (
                          <span key={p} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{p}</span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 pr-3 text-xs text-zinc-500">{timeAgo(u.createdAt)}</td>

                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => unlock(u)}
                          disabled={!u.locked || protectedRow || busy === `unlock:${u.id}`}
                          className={smallBtn}
                        >
                          Unlock
                        </button>
                        <button
                          onClick={() => revoke(u)}
                          disabled={isSelf || protectedRow || busy === `revoke:${u.id}`}
                          title={isSelf ? 'Use your own dashboard to manage your sessions' : undefined}
                          className={`${smallBtn} text-red-400`}
                        >
                          Revoke sessions
                        </button>
                        {can(user.role, 'audit:read') && (
                          <Link href={`/admin/audit?userId=${u.id}`} className={smallBtn}>Logs</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data?.users.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No users found.</p>}
        {loading && !data && <p className="py-6 text-center text-sm text-zinc-500">Loading users...</p>}

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