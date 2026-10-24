'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { timeAgo } from '@/lib/time';
import { eventLabel, toneOf } from '@/lib/auditLabels';
import { parseError } from '@/components/ui';

const PREVIEW = 6;

export default function ActivityCard() {
  const [items, setItems] = useState(null); // null = still loading
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api
      .get('/auth/activity')
      .then(({ data }) => setItems(data.items))
      .catch((err) => setError(parseError(err)));
  }, []);

  const visible = items ? (showAll ? items : items.slice(0, PREVIEW)) : [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <p className="text-sm text-zinc-400">Do not recognize something? Log out everywhere and reset your password.</p>
      </div>

      {error && <p className="text-sm text-red-300">{error.message}</p>}
      {!items && !error && <p className="py-4 text-center text-sm text-zinc-500">Loading...</p>}
      {items?.length === 0 && <p className="text-sm text-zinc-500">No activity yet.</p>}

      <ul className="space-y-2">
        {visible.map((a, i) => (
          <li
            key={`${a.createdAt}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5"
          >
            <div className="min-w-0">
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${toneOf(a.event)}`}>
                {eventLabel(a.event)}
              </span>
              <p className="mt-1 truncate text-xs text-zinc-500">IP {a.ip || 'unknown'}</p>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">{timeAgo(a.createdAt)}</span>
          </li>
        ))}
      </ul>

      {items && items.length > PREVIEW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm text-indigo-400 hover:underline"
        >
          {showAll ? 'Show less' : `Show all (${items.length})`}
        </button>
      )}
    </section>
  );
}