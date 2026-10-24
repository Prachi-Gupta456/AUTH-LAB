// Where to go after login. Only same-site paths are allowed.
// Blocked: "https://evil.com", "//evil.com", "/\evil.com" (browsers treat /\ like //)
export const getNext = () => {
  const next = new URLSearchParams(window.location.search).get('next');
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  return safe ? next : '/dashboard';
};