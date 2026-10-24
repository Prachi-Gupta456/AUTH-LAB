import { useEffect, useState } from 'react';
import api from '@/lib/api';

let cached = null; // fetched once, shared by every component

export default function useConfig() {
  const [config, setConfig] = useState(cached);

  useEffect(() => {
    if (cached) return;
    api
      .get('/auth/config')
      .then(({ data }) => {
        cached = { phoneOtp: data.phoneOtp };
        setConfig(cached);
      })
      .catch(() => {}); // on failure we keep the default (feature shown), backend still protects
  }, []);

  // While loading we assume "available" so the tab doesn't flicker
  return config || { phoneOtp: true };
}