'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import SessionList from '@/components/SessionList';
import PhoneCard from '@/components/PhoneCard';
import MfaCard from '@/components/MfaCard';
import ConnectedAccounts from '@/components/ConnectedAccounts';
import QrCard from '@/components/QrCard';
import ActivityCard from '@/components/ActivityCard';
import AdminCard from '@/components/AdminCard';
import DeveloperCard from '@/components/DeveloperCard';



export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard 🔐</h1>
        <button
          onClick={logout}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
        >
          Logout
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">Logged in as</p>
        <p className="text-xl font-semibold">{user.name}</p>
        <p className="text-zinc-400">{user.email}</p>
        <span className="mt-3 inline-block rounded-full bg-indigo-950 px-3 py-1 text-xs text-indigo-300">
          role: {user.role}
        </span>
        <span className={`ml-2 inline-block rounded-full px-3 py-1 text-xs ${user.isEmailVerified ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
          }`}>
          {user.isEmailVerified ? 'email verified' : 'email unverified'}
        </span>
        {user.mfa?.enabled && (
          <span className="ml-2 inline-block rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
            2FA on
          </span>
        )}
      </div>
      <AdminCard />

      <PhoneCard />
      <MfaCard />
      <ConnectedAccounts />
      <QrCard />
      <DeveloperCard />
      <SessionList />
      <ActivityCard />
    </div>
  );
}

