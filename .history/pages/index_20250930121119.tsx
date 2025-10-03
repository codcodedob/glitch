// pages/index.tsx
import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Establishment = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km?: number;
  code?: string | null;
  code_updated_at?: string | null;
};

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posStatus, setPosStatus] = useState<
    "idle" | "prompting" | "granted" | "denied" | "unavailable"
  >("idle");

  const [radiusKm, setRadiusKm] = useState<number>(0.5);
  const [results, setResults] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Avoid spamming the endpoint on repeated clicks
  const inFlight = useRef(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPosStatus("unavailable");
      return;
    }
    // Eagerly ask for high-accuracy position once the page is visible
    // but keep UX explicit with a button as well
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPosStatus("unavailable");
      return;
    }
    setPosStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setPosStatus("granted");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setPosStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, []);

  const fetchNearest = useCallback(async () => {
    if (!pos || inFlight.current) return;
    setLoading(true);
    setFetchError(null);
    inFlight.current = true;
    try {
      const q = new URLSearchParams({
        lat: String(pos.lat),
        lng: String(pos.lng),
        radius_km: String(radiusKm),
      });
      const res = await fetch(`/api/nearest?${q.toString()}`, {
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server ${res.status}: ${txt || res.statusText}`);
      }
      const data = (await res.json()) as { establishments?: Establishment[] };
      setResults(data.establishments ?? []);
    } catch (e: any) {
      setFetchError(e?.message ?? "Failed to fetch nearby places.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [pos, radiusKm]);

  // Auto-fetch when position first arrives
  useEffect(() => {
    if (pos) fetchNearest();
  }, [pos, fetchNearest]);

  const header = useMemo(
    () => (!pos ? "Share your location to begin" : `Nearest bathrooms within ${radiusKm} km`),
    [pos, radiusKm]
  );

  return (
    <>
      <Head>
        <title>Bathroom Code Finder</title>
        <meta
          name="description"
          content="Find the nearest establishment and see the current restroom code (crowd-verified)."
        />
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl p-6 sm:p-8">
          <header className="mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold">Bathroom Code Finder</h1>
            <p className="text-sm opacity-70 mt-1">
              Uses your location to find nearby establishments and shows the latest restroom code.
            </p>
          </header>

          {/* Controls */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
                <div>
                  <label className="block text-xs opacity-70 mb-1">Search radius (km)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value || "0.5"))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs opacity-70 mb-1">Location</label>
                  {!pos ? (
                    <button
                      onClick={requestLocation}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-4 font-medium hover:bg-slate-700"
                    >
                      {posStatus === "prompting" ? "Requesting…" : "Use my current location"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-900/40 px-2.5 py-1 text-xs text-emerald-100">
                        location ready
                      </span>
                      <button
                        onClick={requestLocation}
                        className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
                        title="Refresh location"
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-1 sm:mt-0">
                <button
                  onClick={fetchNearest}
                  disabled={!pos || loading}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-5 font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {loading ? "Searching…" : "Find nearby"}
                </button>
              </div>
            </div>

            {/* Permission & errors */}
            {!pos && posStatus === "denied" && (
              <p className="mt-3 text-pink-300">
                Location permission denied. Enable it in your browser settings and try again.
              </p>
            )}
            {posStatus === "unavailable" && (
              <p className="mt-3 text-pink-300">
                Geolocation is not available on this device/browser.
              </p>
            )}
            {fetchError && <p className="mt-3 text-pink-300">{fetchError}</p>}
          </div>

          {/* Map */}
          {pos && (
            <div className="mt-5">
              <MapView center={pos} places={results} />
            </div>
          )}

          {/* Results list */}
          <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">{header}</h2>

            <ul className="mt-3 divide-y divide-slate-800">
              {results.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {r.name}{" "}
                        {typeof r.distance_km === "number" && (
                          <span className="ml-2 inline-block rounded-full border border-emerald-800 bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-100">
                            {r.distance_km.toFixed(2)} km
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-80">{r.address}</div>

                      {r.code ? (
                        <div className="mt-2">
                          <div className="text-xs opacity-80">Bathroom code</div>
                          <div className="font-mono text-xl">{r.code}</div>
                          {r.code_updated_at && (
                            <div className="text-xs opacity-70">
                              Updated {new Date(r.code_updated_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs opacity-70">
                          No code on record yet — ask the staff and share back! ✍️
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}

              {results.length === 0 && (
                <li className="py-6 text-sm opacity-75">
                  No places found in range yet. Try a larger radius.
                </li>
              )}
            </ul>
          </section>

          <footer className="mt-8 text-center text-xs opacity-60">
            Crowd-sourced codes. Please be respectful and follow venue policies.
          </footer>
        </div>
      </div>
    </>
  );
}
