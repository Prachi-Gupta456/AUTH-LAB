import { useEffect, useState } from 'react';

// Returns `value` only after it stopped changing for `ms` milliseconds.
// Used for search boxes so we don't hit the API on every keystroke.
export default function useDebounce(value, ms = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id); // typing again cancels the previous timer
  }, [value, ms]);

  return debounced;
}