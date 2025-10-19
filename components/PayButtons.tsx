// components/PayButtons.tsx
"use client";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function PayButtons() {
  const [busy, setBusy] = useState(false);

  async function start(priceId: string, mode: "payment" | "subscription" = "subscription") {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase!.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return alert("Please sign in first.");

    setBusy(true);
    try {
      const r = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId, userId, mode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to create session");
      window.location.href = j.url;
    } catch (e:any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => start(process.env.NEXT_PUBLIC_STRIPE_PRICE_GLITCH!, "subscription")}
              disabled={busy}
              className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 text-emerald-50">
        Subscribe: Glitch
      </button>
      <button onClick={() => start(process.env.NEXT_PUBLIC_STRIPE_PRICE_DEMANDX!, "payment")}
              disabled={busy}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2">
        $1 One-off
      </button>
    </div>
  );
}
