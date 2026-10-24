const API_URL = process.env.NEXT_PUBLIC_API_URL;

const btn =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9a6.1 6.1 0 1 1 0-12.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.300.8-1.600-2.600-.3-5.300-1.300-5.300-5.700 0-1.300.5-2.300 1.200-3.100-.1-.3-.5-1.500.1-3.100 0 0 1-.3 3.200 1.200a11 11 0 0 1 5.800 0c2.200-1.500 3.200-1.200 3.200-1.200.6 1.600.2 2.800.1 3.100.8.800 1.200 1.800 1.200 3.100 0 4.400-2.700 5.400-5.300 5.700.4.4.8 1.100.8 2.200v3.300c0 .3.2.7.8.6A11.500 11.500 0 0 0 12 .5z" />
    </svg>
  );
}

export default function OAuthButtons() {
  return (
    <div className="mb-5">
      <div className="space-y-2">
        {/* Plain <a>: we want a full-page navigation to the backend, not an axios call */}
        <a href={`${API_URL}/auth/oauth/google`} className={btn}>
          <GoogleIcon /> Continue with Google
        </a>
        <a href={`${API_URL}/auth/oauth/github`} className={btn}>
          <GitHubIcon /> Continue with GitHub
        </a>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        or use email
        <span className="h-px flex-1 bg-zinc-800" />
      </div>
    </div>
  );
}