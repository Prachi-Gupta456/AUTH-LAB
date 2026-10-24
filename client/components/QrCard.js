import Link from 'next/link';

export default function QrCard() {
  return (
    <section className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-lg font-semibold">Approve a QR login</h2>
        <p className="text-sm text-zinc-400">Sign in on another device by scanning its QR code</p>
      </div>
      <Link
        href="/scan"
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500"
      >
        Scan QR
      </Link>
    </section>
  );
}