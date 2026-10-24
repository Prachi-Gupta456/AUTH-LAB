'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { setAccessToken, refreshAccessToken } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Restore the session on page load (cookie -> new access token)
  useEffect(() => {
    refreshAccessToken()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null)) // a 401 here is normal when logged out
      .finally(() => setLoading(false));
  }, []);

  // The axios interceptor fires this when the session is dead
  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      router.push('/login');
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [router]);

  // Every login response goes through here.
  // MFA on  -> hand back the mfaToken, don't touch user/token
  // MFA off -> store token + user, we are logged in
  const applyLoginResult = (data) => {
    if (data.mfaRequired) return { mfaRequired: true, mfaToken: data.mfaToken };
    setAccessToken(data.accessToken);
    setUser(data.user);
    return { mfaRequired: false };
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return applyLoginResult(data);
  };

  const register = async (name, email, password) => {
    await api.post('/auth/register', { name, email, password });
    await login(email, password); // auto-login after register
  };

  // Used by OTP logins (email / phone): they call the API themselves
  const setSession = applyLoginResult;

  // Step 2 of an MFA login
  const verifyMfa = async (mfaToken, code) => {
    const { data } = await api.post('/mfa/login-verify', { mfaToken, code });
    return applyLoginResult(data);
  };

  // Re-fetch the user (after email verify, phone link, MFA enable/disable)
  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setSession, refreshUser, verifyMfa }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);