'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MfaChallenge from '@/components/MfaChallenge';

export default function OAuthCallbackPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mfaToken, setMfaToken] = useState(null);
  const [hashRead, setHashRead] = useState(false);

  // Step A: read the mfaToken from the URL fragment, then erase it from the address bar
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('mfaToken');
    if (token) {
      setMfaToken(token);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setHashRead(true);
  }, []);

  // Step B: no MFA needed? AuthContext already tried to restore the session from the cookie.
  useEffect(() => {
    if (loading || !hashRead || mfaToken) return;
    router.replace(user ? '/dashboard' : '/login?oauth_error=OAUTH_SESSION_FAILED');
  }, [loading, hashRead, mfaToken, user, router]);

  if (mfaToken) {
    return (
      <MfaChallenge
        mfaToken={mfaToken}
        onDone={() => router.replace('/dashboard')}
        onCancel={(message) => {
          setMfaToken(null);
          router.replace(message ? '/login?oauth_error=OAUTH_SESSION_FAILED' : '/login');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-zinc-500">
      Signing you in...
    </div>
  );
}