// pages/cancel.tsx
import Link from "next/link";
import Head from "next/head";

export default function CancelPage() {
  return (
    <>
      <Head>
        <title>Checkout canceled — Glitch</title>
      </Head>
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Checkout canceled</h1>
          <p className="mt-2 opacity-80">No worries — you haven’t been charged.</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 font-medium hover:bg-slate-700"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
