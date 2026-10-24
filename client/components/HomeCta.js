'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const primary =
  'rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium transition hover:bg-indigo-500';
const ghost =
  'rounded-lg border border-zinc-700 px-6 py-2.5 text-sm transition hover:bg-zinc-800';

export default function HomeCta() {
  const { user, loading } = useAuth();

  // Same height as the real buttons, so the page doesn't jump when the session check finishes
  if (loading) {
    return <div className="mx-auto h-10 w-56 animate-pulse rounded-lg bg-zinc-800" />;
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-zinc-400">
          Welcome back, <span className="text-zinc-200">{user.name}</span>
        </p>
        <Link href="/dashboard" className={primary}>
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link href="/register" className={primary}>
        Get started
      </Link>
      <Link href="/login" className={ghost}>
        Log in
      </Link>
    </div>
  );
}