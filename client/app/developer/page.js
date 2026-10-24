'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Field, Button, ErrorBox, parseError } from '@/components/ui';

export default function DeveloperPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: '', uris: '', confidential: true });
  const [created, setCreated] = useState(null); // { client, clientSecret } shown ONCE
  const [copied, setCopied] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/developer');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/sso/clients');
      setClients(data.clients);
    } catch (err) {
      setError(parseError(err));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const create = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const redirectUris = form.uris.split('\n').map((s) => s.trim()).filter(Boolean);
      const { data } = await api.post('/sso/clients', {
        name: form.name,
        redirectUris,
        confidential: form.confidential,
      });
      setCreated({ client: data.client, clientSecret: data.clientSecret });
      setForm({ name: '', uris: '', confidential: true });
      await load();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? Its tokens will stop working immediately.`)) return;
    try {
      await api.delete(`/sso/clients/${c._id}`);
      if (created?.client._id === c._id) setCreated(null);
      await load();
    } catch (err) {
      setError(parseError(err));
    }
  };

  const copy = async (label, text) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  if (authLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Developer 🧑‍💻</h1>
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <ErrorBox error={error} />

      {/* ---------- secret, shown once ---------- */}
      {created && (
        <section className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
          <h2 className="mb-1 text-lg font-semibold">&quot;{created.client.name}&quot; created ✅</h2>
          <p className="mb-4 text-sm text-amber-300">
            {created.clientSecret
              ? 'Copy the secret now. It is shown only once and we only store its hash.'
              : 'Public client: it has no secret and relies on PKCE only.'}
          </p>

          <p className="mb-1 text-xs text-zinc-400">Client ID</p>
          <div className="mb-3 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-black p-2 text-xs text-emerald-400">
              {created.client.clientId}
            </code>
            <button
              onClick={() => copy('id', created.client.clientId)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
            >
              {copied === 'id' ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          {created.clientSecret && (
            <>
              <p className="mb-1 text-xs text-zinc-400">Client secret</p>
              <div className="mb-3 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-black p-2 text-xs text-emerald-400">
                  {created.clientSecret}
                </code>
                <button
                  onClick={() => copy('secret', created.clientSecret)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                >
                  {copied === 'secret' ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => setCreated(null)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            I have saved it
          </button>
        </section>
      )}

      {/* ---------- register form ---------- */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-1 text-lg font-semibold">Register an app</h2>
        <p className="mb-4 text-sm text-zinc-400">Let another app offer &quot;Login with Auth Lab&quot;</p>

        <form onSubmit={create}>
          <Field
            label="App name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-zinc-400">Redirect URIs (one per line)</span>
            <textarea
              rows={3}
              value={form.uris}
              onChange={(e) => setForm({ ...form, uris: e.target.value })}
              placeholder="http://localhost:5000/callback"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none transition focus:border-indigo-500"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Matched exactly: even a trailing slash counts. https only (http allowed for localhost).
            </span>
          </label>

          <label className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.confidential}
              onChange={(e) => setForm({ ...form, confidential: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
            Confidential client (has a server that can keep a secret)
          </label>

          <Button type="submit" loading={loading} disabled={!form.name.trim() || !form.uris.trim()}>
            Create client
          </Button>
        </form>
      </section>

      {/* ---------- list ---------- */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-semibold">Your apps</h2>

        {clients.length === 0 ? (
          <p className="text-sm text-zinc-500">No apps yet.</p>
        ) : (
          <ul className="space-y-3">
            {clients.map((c) => (
              <li key={c._id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {c.name}
                    <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      {c.confidential ? 'confidential' : 'public'}
                    </span>
                  </p>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-red-400 hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
                <p className="break-all font-mono text-xs text-zinc-500">{c.clientId}</p>
                {c.redirectUris.map((u) => (
                  <p key={u} className="break-all font-mono text-xs text-zinc-600">→ {u}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}