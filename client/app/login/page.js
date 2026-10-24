
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getNext } from '@/lib/next';
import { oauthErrorMessage } from '@/lib/oauthErrors';
import useCountdown from '@/lib/useCountdown';
import useConfig from '@/lib/useConfig';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import PhoneInput, { toE164 } from '@/components/PhoneInput';
import MfaChallenge from '@/components/MfaChallenge';
import OAuthButtons from '@/components/OAuthButtons';
import QrLogin from '@/components/QrLogin';
import { Card, Field, Button, ErrorBox, InfoBox, ResendButton, parseError } from '@/components/ui';

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const { user, loading: authLoading, login, setSession } = useAuth();
  const router = useRouter();

  // Renamed: "phoneEnabled" = is the feature available. "phoneOtp" (below) = the code typed by the user.
  const { phoneOtp: phoneEnabled } = useConfig();

  const [tab, setTab] = useState('password'); // 'password' | 'otp' | 'phone' | 'qr'
  const [form, setForm] = useState({ email: '', password: '' });

  // email OTP
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'code'
  const [otp, setOtp] = useState('');

  // phone OTP
  const [phone, setPhone] = useState({ countryCode: '+91', number: '' });
  const [phoneStep, setPhoneStep] = useState('number'); // 'number' | 'code'
  const [phoneOtp, setPhoneOtp] = useState('');

  // MFA second step
  const [mfaToken, setMfaToken] = useState(null);

  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { seconds, start } = useCountdown(0);

  // Already logged in? Go where we were headed (or the dashboard)
  useEffect(() => {
    if (!authLoading && user) router.replace(getNext());
  }, [authLoading, user, router]);

  // Backend redirects here with ?oauth_error=CODE when OAuth fails
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('oauth_error');
    if (!code) return;
    setError({ message: oauthErrorMessage(code) });
    window.history.replaceState(null, '', '/login'); // clean the URL so a refresh doesn't re-show it
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const switchTab = (t) => {
    setTab(t);
    setError(null);
    setInfo(null);
    setOtpStep('email');
    setOtp('');
    setPhoneStep('number');
    setPhoneOtp('');
  };

  // Called after ANY first factor succeeds
  const afterFirstFactor = (result) => {
    if (result.mfaRequired) setMfaToken(result.mfaToken);
    else router.push(getNext());
  };

  // Called by MfaChallenge when the mfaToken expired or the user taps "Back"
  const cancelMfa = (message) => {
    switchTab(tab);
    setMfaToken(null);
    setError(message ? { message } : null);
  };

  // ---------- Password login ----------
  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      afterFirstFactor(result);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ---------- Email OTP ----------
  const sendCode = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/email/send-otp', {
        email: form.email,
        purpose: 'login',
      });
      setInfo(data.message);
      setOtpStep('code');
      setOtp('');
      start(RESEND_SECONDS);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSendSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const onVerifySubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/email/verify-otp', {
        email: form.email,
        otp,
        purpose: 'login',
      });
      afterFirstFactor(setSession(data));
    } catch (err) {
      setError(parseError(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Phone OTP ----------
  const sendPhoneCode = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/login/send-otp', {
        phone: toE164(phone.countryCode, phone.number),
      });
      setInfo(data.message);
      setPhoneStep('code');
      setPhoneOtp('');
      start(RESEND_SECONDS);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const onPhoneSendSubmit = (e) => {
    e.preventDefault();
    sendPhoneCode();
  };

  const onPhoneVerifySubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/login/verify-otp', {
        phone: toE164(phone.countryCode, phone.number),
        otp: phoneOtp,
      });
      afterFirstFactor(setSession(data));
    } catch (err) {
      setError(parseError(err));
      setPhoneOtp('');
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (active) =>
    `flex-1 rounded-md py-1.5 text-xs font-medium transition sm:text-sm ${
      active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
    }`;

  // MFA step replaces the whole login card (must stay BELOW every hook)
  if (mfaToken) {
    return (
      <MfaChallenge
        mfaToken={mfaToken}
        onDone={() => router.push(getNext())}
        onCancel={cancelMfa}
      />
    );
  }

  return (
    <Card title="Welcome back 👋" subtitle="Log in to your account">
      <OAuthButtons />

      <div className="mb-5 flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        <button type="button" className={tabClass(tab === 'password')} onClick={() => switchTab('password')}>
          Password
        </button>
        <button type="button" className={tabClass(tab === 'otp')} onClick={() => switchTab('otp')}>
          Email OTP
        </button>
        <button
          type="button"
          className={`${tabClass(tab === 'phone')} ${!phoneEnabled ? 'opacity-50' : ''}`}
          onClick={() => switchTab('phone')}
        >
          Phone OTP
        </button>
        <button type="button" className={tabClass(tab === 'qr')} onClick={() => switchTab('qr')}>
          QR
        </button>
      </div>

      <ErrorBox error={error} />
      <InfoBox message={info} />

      {/* ---------- Password ---------- */}
      {tab === 'password' && (
        <form onSubmit={onPasswordSubmit}>
          <Field label="Email" name="email" type="email" value={form.email} onChange={onChange} />
          <Field label="Password" name="password" type="password" value={form.password} onChange={onChange} />
          <div className="mb-4 text-right">
            <Link href="/forgot-password" className="text-sm text-indigo-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" loading={loading}>Login</Button>
        </form>
      )}

      {/* ---------- Email OTP ---------- */}
      {tab === 'otp' && otpStep === 'email' && (
        <form onSubmit={onSendSubmit}>
          <Field label="Email" name="email" type="email" value={form.email} onChange={onChange} />
          <Button type="submit" loading={loading}>Send OTP</Button>
        </form>
      )}

      {tab === 'otp' && otpStep === 'code' && (
        <form onSubmit={onVerifySubmit}>
          <p className="mb-3 text-sm text-zinc-400">
            Enter the 6-digit code sent to <span className="text-zinc-200">{form.email}</span>
          </p>
          <div className="mb-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          </div>
          <Button type="submit" loading={loading} disabled={otp.length !== 6}>Verify & Login</Button>
          <div className="mt-4 flex items-center justify-between">
            <ResendButton seconds={seconds} onClick={sendCode} />
            <button type="button" onClick={() => switchTab('otp')} className="text-sm text-zinc-400 hover:underline">
              Change email
            </button>
          </div>
        </form>
      )}

      {/* ---------- Phone OTP: unavailable ---------- */}
      {tab === 'phone' && !phoneEnabled && (
        <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-300">
          <p className="mb-3">Phone OTP is temporarily unavailable. Please sign in with another method:</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchTab('password')}
              className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs hover:bg-amber-950"
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => switchTab('otp')}
              className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs hover:bg-amber-950"
            >
              Email OTP
            </button>
          </div>
        </div>
      )}

      {/* ---------- Phone OTP: available ---------- */}
      {tab === 'phone' && phoneEnabled && phoneStep === 'number' && (
        <form onSubmit={onPhoneSendSubmit}>
          <PhoneInput
            countryCode={phone.countryCode}
            number={phone.number}
            onCountryChange={(countryCode) => setPhone({ ...phone, countryCode })}
            onNumberChange={(number) => setPhone({ ...phone, number })}
          />
          <Button type="submit" loading={loading} disabled={phone.number.length < 6}>
            Send SMS code
          </Button>
        </form>
      )}

      {tab === 'phone' && phoneEnabled && phoneStep === 'code' && (
        <form onSubmit={onPhoneVerifySubmit}>
          <p className="mb-3 text-sm text-zinc-400">
            Enter the 6-digit code sent to{' '}
            <span className="text-zinc-200">{toE164(phone.countryCode, phone.number)}</span>
          </p>
          <div className="mb-4">
            <OtpInput value={phoneOtp} onChange={setPhoneOtp} disabled={loading} />
          </div>
          <Button type="submit" loading={loading} disabled={phoneOtp.length !== 6}>
            Verify & Login
          </Button>
          <div className="mt-4 flex items-center justify-between">
            <ResendButton seconds={seconds} onClick={sendPhoneCode} />
            <button type="button" onClick={() => switchTab('phone')} className="text-sm text-zinc-400 hover:underline">
              Change number
            </button>
          </div>
        </form>
      )}

      {/* ---------- QR ---------- */}
      {tab === 'qr' && <QrLogin onSuccess={() => router.push(getNext())} />}

      <p className="mt-6 text-center text-sm text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-indigo-400 hover:underline">Register</Link>
      </p>
    </Card>
  );
}