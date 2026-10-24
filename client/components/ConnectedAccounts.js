'use client';

import { useAuth } from '@/context/AuthContext';

const PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

export default function ConnectedAccounts() {
  const { user } = useAuth();
  const linked = user.providers || [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Connected accounts</h2>
        <p className="text-sm text-zinc-400">Sign-in providers linked to this account</p>
      </div>

      <ul className="space-y-2">
        {PROVIDERS.map((p) => {
          const isLinked = linked.includes(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <span className="text-sm font-medium">{p.label}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  isLinked ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {isLinked ? 'Connected' : 'Not connected'}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-zinc-500">
        A provider is linked automatically when you sign in with it using the same verified email.
      </p>
    </section>
  );
}