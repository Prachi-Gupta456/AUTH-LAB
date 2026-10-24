import Link from 'next/link';

export default function DeveloperCard() {
  return (
    <section className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-lg font-semibold">Developer</h2>
        <p className="text-sm text-zinc-400">Register apps that use &quot;Login with Auth Lab&quot;</p>
      </div>
      <Link
        href="/developer"
        className="shrink-0 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
      >
        Open
      </Link>
    </section>
  );
}