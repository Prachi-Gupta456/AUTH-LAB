'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, Field, Button, ErrorBox, parseError } from '@/components/ui';
import OAuthButtons from '@/components/OAuthButtons';

export default function RegisterPage() {
  const { user, loading: authLoading, register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const justRegistered = useRef(false);

  useEffect(() => {
    // skip the auto-redirect while we are handling the post-register redirect ourselves
    if (!authLoading && user && !justRegistered.current) router.replace('/dashboard');
  }, [authLoading, user, router]);

  
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });


  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      justRegistered.current = true;
      await register(form.name, form.email, form.password);
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}&sent=1`);
    } catch (err) {
      justRegistered.current = false;
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Create account 🚀" subtitle="Ready in one min..">
      <OAuthButtons />
      <ErrorBox error={error} />
      <form onSubmit={onSubmit}>
        <Field label="Name" name="name" value={form.name} onChange={onChange} />
        <Field label="Email" name="email" type="email" value={form.email} onChange={onChange} />
        <Field label="Password" name="password" type="password" value={form.password} onChange={onChange} />
        <Button type="submit" loading={loading}>Register</Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Already registered?{' '}
        <Link href="/login" className="text-indigo-400 hover:underline">Login here</Link>
      </p>
    </Card>
  );
}