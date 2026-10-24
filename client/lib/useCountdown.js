import { useCallback, useEffect, useState } from 'react';

// Counts down from N seconds to 0. Used for the "Resend OTP in 42s" timer.
export default function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id); // cleanup so timers never stack up
  }, [seconds]);

  const start = useCallback((s = 60) => setSeconds(s), []);
  return { seconds, start };
}