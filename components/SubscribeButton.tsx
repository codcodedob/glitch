// components/SubscribeButtons.tsx
"use client";

export default function SubscribeButtons() {
  async function go(priceId: string, mode: "payment" | "subscription" = "payment") {
    try {
      const r = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId, mode }),
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Checkout failed");
      window.location.href = j.url;
    } catch (e: any) {
      alert(e.message || "Could not start checkout");
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {/* $1 Glitch Pass (one-time) */}
      <button
        className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 text-emerald-50"
        onClick={() =>
          go(process.env.NEXT_PUBLIC_STRIPE_PRICE_GLITCH || process.env.NEXT_PUBLIC_STRIPE_PRICE_DEMANDX || "", "payment")
        }
      >
        Get Glitch Pass – $1
      </button>

      {/* Monthly tiers (if you want subs) */}
      <button
        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
        onClick={() => go(process.env.NEXT_PUBLIC_STRIPE_PRICE_ADOBSENSE || "", "subscription")}
      >
        AdObSense (monthly)
      </button>
      <button
        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
        onClick={() => go(process.env.NEXT_PUBLIC_STRIPE_PRICE_DOBEONE || "", "subscription")}
      >
        DobeOne (monthly)
      </button>
      <button
        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
        onClick={() => go(process.env.NEXT_PUBLIC_STRIPE_PRICE_DEMANDX || "", "subscription")}
      >
        DemandX (monthly)
      </button>
    </div>
  );
}
