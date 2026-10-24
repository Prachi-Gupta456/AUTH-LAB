'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import useCountdown from '@/lib/useCountdown';
import OtpInput from '@/components/OtpInput';
import { Card, Field, Button, ErrorBox, InfoBox, ResendButton, parseError } from '@/components/ui';

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('email'); // 'email' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { seconds, start } = useCountdown(0);

  const sendCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setInfo(data.message);
      setStep('reset');
      start(RESEND_SECONDS);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const onEmailSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const onResetSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      setStep('done');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <Card title="Password updated ✅" subtitle="You have been logged out of all devices.">
        <Link
          href="/login"
          className="block w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium transition hover:bg-indigo-500"
        >
          Back to login
        </Link>
      </Card>
    );
  }

  return (
    <Card
      title="Forgot password 🔑"
      subtitle={step === 'email' ? 'We will email you a one-time code' : `Enter the code sent to ${email}`}
    >
      <ErrorBox error={error} />
      <InfoBox message={info} />

      {step === 'email' && (
        <form onSubmit={onEmailSubmit}>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading}>Send OTP</Button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={onResetSubmit}>
          <div className="mb-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          </div>
          <Field
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" loading={loading} disabled={otp.length !== 6}>Reset password</Button>
          <div className="mt-4">
            <ResendButton seconds={seconds} onClick={sendCode} />
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-400">
        <Link href="/login" className="text-indigo-400 hover:underline">Back to login</Link>
      </p>
    </Card>
  );
}