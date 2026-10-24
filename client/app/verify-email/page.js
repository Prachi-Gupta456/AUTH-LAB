'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import useCountdown from '@/lib/useCountdown';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import { Card, Button, ErrorBox, InfoBox, ResendButton, parseError } from '@/components/ui';

const RESEND_SECONDS = 60;

function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, refreshUser } = useAuth();

  // email comes from the URL (after register) or from the logged-in user (dashboard banner)
  const email = params.get('email') || user?.email || '';
  const justSent = params.get('sent') === '1';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(justSent ? 'We sent a 6-digit code to your email.' : null);
  const [loading, setLoading] = useState(false);
  const { seconds, start } = useCountdown(justSent ? RESEND_SECONDS : 0);

  // Already verified? Nothing to do here.
  useEffect(() => {
    if (user?.isEmailVerified) router.replace('/dashboard');
  }, [user, router]);

  const sendCode = async () => {
    setError(null);
    try {
      const { data } = await api.post('/auth/email/send-otp', { email, purpose: 'email_verify' });
      setInfo(data.message);
      start(RESEND_SECONDS);
    } catch (err) {
      setError(parseError(err));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/email/verify-otp', { email, otp, purpose: 'email_verify' });
      if (user) {
        await refreshUser(); // pull isEmailVerified: true into context
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError(parseError(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <Card title="Verify email" subtitle="No email found. Please log in first." />
    );
  }

  return (
    <Card title="Verify your email ✉️" subtitle={`Enter the code sent to ${email}`}>
      <ErrorBox error={error} />
      <InfoBox message={info} />
      <form onSubmit={onSubmit}>
        <div className="mb-4">
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
        </div>
        <Button type="submit" loading={loading} disabled={otp.length !== 6}>Verify</Button>
      </form>
      <div className="mt-4 flex items-center justify-between">
        <ResendButton seconds={seconds} onClick={sendCode} />
        <button
          type="button"
          onClick={() => router.push(user ? '/dashboard' : '/login')}
          className="text-sm text-zinc-400 hover:underline"
        >
          Skip for now
        </button>
      </div>
    </Card>
  );
}

// useSearchParams needs a Suspense boundary in the Next.js App Router
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}