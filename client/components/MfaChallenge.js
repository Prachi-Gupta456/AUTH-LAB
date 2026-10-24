'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import { Card, Field, Button, ErrorBox, parseError } from '@/components/ui';

export default function MfaChallenge({ mfaToken, onDone, onCancel }) {
  const { verifyMfa } = useAuth();
  const [useBackup, setUseBackup] = useState(false);
  const [otp, setOtp] = useState('');
  const [backup, setBackup] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const code = useBackup ? backup.trim() : otp;
  const ready = useBackup ? backup.trim().length >= 10 : otp.length === 6;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyMfa(mfaToken, code);
      onDone();
    } catch (err) {
      const data = parseError(err);
      // The 5-minute mfaToken died: go back to step 1 with a message
      if (data.code === 'MFA_TOKEN_INVALID') return onCancel(data.message);
      setError(data);
      setOtp('');
      setBackup('');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setUseBackup((v) => !v);
    setError(null);
    setOtp('');
    setBackup('');
  };

  return (
    <Card
      title="Two-step verification 🔐"
      subtitle={
        useBackup
          ? 'Enter one of your backup codes'
          : 'Enter the 6-digit code from your authenticator app'
      }
    >
      <ErrorBox error={error} />
      <form onSubmit={onSubmit}>
        {useBackup ? (
          <Field
            label="Backup code"
            placeholder="a1b2c-3d4e5"
            autoComplete="off"
            value={backup}
            onChange={(e) => setBackup(e.target.value)}
          />
        ) : (
          <div className="mb-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
          </div>
        )}
        <Button type="submit" loading={loading} disabled={!ready}>
          Verify
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={toggle} className="text-sm text-indigo-400 hover:underline">
          {useBackup ? 'Use authenticator app' : 'Use a backup code'}
        </button>
        <button type="button" onClick={() => onCancel()} className="text-sm text-zinc-400 hover:underline">
          Back to login
        </button>
      </div>
    </Card>
  );
}