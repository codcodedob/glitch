"use client";

import { useEffect, useRef, useState } from "react";
import PayButtons from "@/components/PayButtons";
import { canViewCodes, type FirebaseUserShape } from "@/lib/subscription";

type EstablishmentLite = {
  id?: string;
  name?: string;
  address?: string | null;
  lat?: number;
  lng?: number;
};

type ResolveCandidate = {
  place_id: string;
  name: string;
  address?: string | null;
  lat?: number;
  lng?: number;
  code?: string | null;
  code_updated_at?: string | null;
};

type ResolveResponse =
  | { status: "code"; establishment: EstablishmentLite; code: string; code_updated_at?: string | null; candidates?: ResolveCandidate[] }
  | { status: "no_code" | "no_restroom" | "not_found" | "error"; establishment?: EstablishmentLite; candidates?: ResolveCandidate[]; code?: null; code_updated_at?: string | null; error?: string };

export default function CurrentCodeBanner() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [data, setData] = useState<ResolveResponse | null>(null);

  // TODO: replace with your real profile fetch
  const [userProfile, setUserProfile] = useState<FirebaseUserShape | null>(null);
  const [oneOffUnlocked] = useState<boolean>(false); // set true after $1 success (from webhook or success page)

  const timer = useRef<number | null>(null);

  // quick demo profile: you can call your /api/me-like route and map to FirebaseUserShape
  useEffect(() => {
    // Example: unauth means gated
    setUserProfile(null);
  }, []);

  // get location once, then poll
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!pos) return;
    let aborted = false;

    async function tick() {
      try {
        const q = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng) });
        const r = await fetch(`/api/resolve-building?${q.toString()}`, { headers: { "cache-control": "no-store" } });
        if (!r.ok) throw new Error(await r.text());
        const j = (await r.json()) as ResolveResponse;
        if (!aborted) setData(j);
      } catch {
        /* ignore */
      }
    }

    void tick();
    timer.current = window.setInterval(tick, 8000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [pos?.lat, pos?.lng]);

  if (!data) return null;

  const allowed = canViewCodes({ userProfile, oneOffUnlocked });
  const name = data.establishment?.name ?? "This place";
  const addr = data.establishment?.address ?? "";
  const base = "rounded-xl border p-3 text-sm shadow-lg";

  let content: JSX.Element = <span>Detecting…</span>;

  if (data.status === "code") {
    content = (
      <div className="flex flex-col">
        <div className="text-xs opacity-70">Likely restroom code at</div>
        <div className="font-semibold">{name}</div>
        <div className="text-xs opacity-70">{addr}</div>
        <div className="mt-2 text-lg font-mono">
          {allowed ? (
            data.code
          ) : (
            <span className="blur-sm select-none">••••</span>
          )}
        </div>
        {data.code_updated_at && (
          <div className="text-xs opacity-60">
            Updated {new Date(data.code_updated_at).toLocaleString()}
          </div>
        )}
        {!allowed && (
          <div className="mt-2">
            <div className="text-xs opacity-75 mb-2">
              Unlock with a plan or a $1 Glitch Pass:
            </div>
            <PayButtons compact oneDollar />
          </div>
        )}
      </div>
    );
  } else if (data.status === "no_restroom") {
    const next = (data.candidates ?? [])[0];
    content = (
      <div>
        <div className="font-medium">🚫 {name}: no restroom</div>
        {next ? (
          <div className="text-xs opacity-70 mt-1">
            Suggestion: <b>{next.name}</b>
            {next.code ? (
              <>
                {" "}
                — code{" "}
                {allowed ? (
                  <span className="font-mono">{next.code}</span>
                ) : (
                  <span className="blur-sm select-none">••••</span>
                )}
              </>
            ) : (
              " — try here"
            )}
          </div>
        ) : (
          <div className="text-xs opacity-70 mt-1">No nearby suggestion yet</div>
        )}
        {!allowed && (
          <div className="mt-2">
            <PayButtons compact oneDollar />
          </div>
        )}
      </div>
    );
  } else if (data.status === "no_code") {
    content = (
      <div>
        <div className="font-medium">✍️ {name}: no code yet</div>
        <div className="text-xs opacity-70 mt-1">Tap a place and add a code if you have it.</div>
      </div>
    );
  } else if (data.status === "not_found") {
    content = <div className="font-medium">We couldn’t locate the exact building. Try moving a bit.</div>;
  } else if (data.status === "error") {
    content = <div className="font-medium">Error: {data.error ?? "Unknown"}</div>;
  }

  return (
    <div className={`fixed left-1/2 top-4 z-[10500] -translate-x-1/2 border-slate-800 bg-slate-900/80 text-slate-100 ${base}`}>
      {content}
    </div>
  );
}
