// pages/checkout/cancelled.tsx
import Link from "next/link";

export default function Cancelled() {
  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold">Checkout cancelled</h1>
        <p className="mt-2 opacity-80">No worries—nothing was charged.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium hover:bg-slate-700"
          >
            Back to the app
          </Link>
          <Link
            href="/pricing"
            className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium hover:bg-slate-700"
          >
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
