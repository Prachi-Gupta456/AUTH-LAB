'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/roles';

export default function AdminCard() {
  const { user } = useAuth();

  // A normal user never even sees this card (the backend would 403 them anyway)
  if (!can(user.role, 'users:read')) return null;

  return (
    <section className="flex items-center justify-between rounded-2xl border border-indigo-900 bg-indigo-950/20 p-6">
      <div>
        <h2 className="text-lg font-semibold">Admin panel</h2>
        <p className="text-sm text-zinc-400">
          Signed in as <span className="font-medium text-indigo-300">{user.role}</span>
        </p>
      </div>
      <Link
        href="/admin"
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500"
      >
        Open
      </Link>
    </section>
  );
}