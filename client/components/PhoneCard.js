
'use client';

import { useState } from 'react';
import api from '@/lib/api';
import useCountdown from '@/lib/useCountdown';
import useConfig from '@/lib/useConfig';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import PhoneInput, { toE164 } from '@/components/PhoneInput';
import { ErrorBox, InfoBox, ResendButton, parseError } from '@/components/ui';

const RESEND_SECONDS = 60;

export default function PhoneCard() {
  const { phoneOtp: phoneEnabled } = useConfig(); // is the feature available?
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState('idle'); // 'idle' | 'number' | 'code'
  const [phone, setPhone] = useState({ countryCode: '+91', number: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { seconds, start } = useCountdown(0);

  const fullPhone = toE164(phone.countryCode, phone.number);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/link/send-otp', { phone: fullPhone });
      setInfo(data.message);
      setStep('code');
      setOtp('');
      start(RESEND_SECONDS);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/phone/link/verify-otp', { phone: fullPhone, otp });
      await refreshUser(); // pulls the new user.phone into context
      setStep('idle');
      setPhone({ countryCode: '+91', number: '' });
      setOtp('');
      setInfo(null);
    } catch (err) {
      setError(parseError(err));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setStep('idle');
    setError(null);
    setInfo(null);
    setOtp('');
  };

  const primaryBtn =
    'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';
  const ghostBtn =
    'rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Phone number</h2>
        <p className="text-sm text-zinc-400">Link a number to log in with SMS codes</p>
      </div>

      {!phoneEnabled && (
        <p className="mb-4 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-300">
          Phone OTP is currently unavailable. You can still sign in with your password, email OTP,
          or an authenticator app.
        </p>
      )}

      <ErrorBox error={error} />
      <InfoBox message={info} />

      {/* Number already linked: "Change" is disabled while SMS is unavailable */}
      {user.phone && step === 'idle' && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-800 bg-emerald-950/20 p-4">
          <div>
            <p className="font-mono text-sm">{user.phone}</p>
            <p className="text-xs text-emerald-400">Verified</p>
          </div>
          <button
            onClick={() => setStep('number')}
            disabled={!phoneEnabled}
            title={!phoneEnabled ? 'Phone OTP is currently unavailable' : undefined}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change
          </button>
        </div>
      )}

      {/* No number yet: "Link phone number" is disabled while SMS is unavailable */}
      {!user.phone && step === 'idle' && (
        <button
          onClick={() => setStep('number')}
          disabled={!phoneEnabled}
          title={!phoneEnabled ? 'Phone OTP is currently unavailable' : undefined}
          className={`${primaryBtn} w-full`}
        >
          Link phone number
        </button>
      )}

      {step === 'number' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <PhoneInput
            countryCode={phone.countryCode}
            number={phone.number}
            onCountryChange={(countryCode) => setPhone({ ...phone, countryCode })}
            onNumberChange={(number) => setPhone({ ...phone, number })}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !phoneEnabled || phone.number.length < 6}
              className={`${primaryBtn} flex-1`}
            >
              {loading ? 'Please wait...' : 'Send SMS code'}
            </button>
            <button type="button" onClick={cancel} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify}>
          <p className="mb-3 text-sm text-zinc-400">
            Enter the 6-digit code sent to <span className="text-zinc-200">{fullPhone}</span>
          </p>
          <div className="mb-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className={`${primaryBtn} flex-1`}
            >
              {loading ? 'Please wait...' : 'Verify & link'}
            </button>
            <button type="button" onClick={cancel} className={ghostBtn}>
              Cancel
            </button>
          </div>
          <div className="mt-4">
            <ResendButton seconds={seconds} onClick={sendCode} />
          </div>
        </form>
      )}
    </section>
  );
}