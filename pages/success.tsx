// pages/success.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Head from "next/head";

type LineItem = {
  id: string;
  description: string | null;
  quantity: number | null;
  amount_subtotal: number | null; // in cents
};

type SessionResp =
  | {
      ok: true;
      session: {
        id: string;
        customer_email: string | null;
        payment_status: string; // 'paid' | ...
        mode: "payment" | "subscription";
        subscription_status?: string | null; // if mode==='subscription'
        currency: string | null; // e.g. 'usd'
        amount_total: number | null; // in cents
        line_items: LineItem[];
      };
    }
  | { ok: false; error: string };

export default function SuccessPage() {
  const [data, setData] = useState<SessionResp | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      setData({ ok: false, error: "Missing session_id." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { "cache-control": "no-store" },
        });
        const j = (await res.json()) as SessionResp;
        setData(j);
      } catch {
        setData({ ok: false, error: "Could not load session details." });
      }
    })();
  }, []);

  const cur = data && data.ok ? (data.session.currency ?? "usd").toUpperCase() : "USD";
  const formatMoney = (cents: number | null | undefined) =>
    typeof cents === "number" ? (cents / 100).toLocaleString(undefined, { style: "currency", currency: cur }) : "—";

  return (
    <>
      <Head>
        <title>Payment Successful — Glitch</title>
      </Head>

      <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-2xl p-6 sm:p-8">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">Glitch</h1>
            <Link href="/" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
              Go home
            </Link>
          </header>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-2xl font-semibold">Thanks — your payment succeeded!</h2>
            <p className="mt-2 opacity-80">
              We’ve received your payment. Your access should activate automatically within a few seconds.
            </p>

            {!data && <div className="mt-6 text-sm opacity-70">Loading session details…</div>}

            {data?.ok && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="opacity-70">Email</div>
                    <div className="font-medium">{data.session.customer_email ?? "—"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="opacity-70">Payment status</div>
                    <div className="font-medium capitalize">{data.session.payment_status}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="opacity-70">Mode</div>
                    <div className="font-medium capitalize">{data.session.mode}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="opacity-70">Total</div>
                    <div className="font-medium">{formatMoney(data.session.amount_total)}</div>
                  </div>
                  {data.session.mode === "subscription" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:col-span-2">
                      <div className="opacity-70">Subscription status</div>
                      <div className="font-medium capitalize">{data.session.subscription_status ?? "—"}</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-2 text-sm opacity-70">Items</div>
                  <ul className="space-y-2 text-sm">
                    {data.session.line_items.map((li) => (
                      <li key={li.id} className="flex items-center justify-between">
                        <span>{li.description ?? "Item"}</span>
                        <span className="opacity-80">
                          x{li.quantity ?? 1} — {formatMoney(li.amount_subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-800 px-5 font-medium text-emerald-50 hover:bg-emerald-700"
                  >
                    Start using Glitch
                  </Link>
                </div>
              </div>
            )}

            {data && !data.ok && (
              <div className="mt-6 rounded-xl border border-pink-800 bg-pink-950/40 p-4 text-sm text-pink-100">
                <div className="font-medium">We couldn’t verify your session.</div>
                <div className="opacity-90">{data.error}</div>
                <div className="mt-3">
                  <Link href="/" className="underline underline-offset-4">
                    Back to home
                  </Link>
                </div>
              </div>
            )}
          </div>

          <footer className="mt-8 text-center text-xs opacity-60">Glitch — bathroom access, simplified.</footer>
        </div>
      </div>
    </>
  );
}
