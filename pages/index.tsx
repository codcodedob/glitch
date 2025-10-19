// pages/index.tsx
"use client";

import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import UpdateCodeModal from "@/components/UpdateCodeModal";
// If you use react-hot-toast, the <Toaster/> should be in _app.tsx

/* ---------- Types ---------- */
export type Establishment = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  distance_km?: number;
  code?: string | null;
  code_updated_at?: string | null;
  google_place_id?: string | null;
};

type NearestResp = { establishments?: Establishment[] };

type Candidate = {
  place_id?: string;
  establishment_id?: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
  code_updated_at?: string | null;
};

/* ---------- Map (client-only) ---------- */
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  /* location + results */
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posStatus, setPosStatus] = useState<"idle" | "prompting" | "granted" | "denied" | "unavailable">("idle");
  const [radiusKm, setRadiusKm] = useState<number>(0.5);
  const [results, setResults] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* modal + selection */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Candidate | null>(null);

  /* center “detail card” when clicking a list item */
  const [centerCard, setCenterCard] = useState<Establishment | null>(null);

  const inFlight = useRef(false);

  /* feature flags via query (e.g., ?map=off) */
  const mapEnabled = useMemo(() => {
    if (typeof window === "undefined") return true;
    const params = new URLSearchParams(window.location.search);
    return params.get("map") !== "off";
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) setPosStatus("unavailable");
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
      const res = await fetch(`/api/nearest?${q.toString()}`, { headers: { "cache-control": "no-store" } });
      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as NearestResp;
      setResults(Array.isArray(data.establishments) ? data.establishments : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch nearby places.";
      setFetchError(msg);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [pos, radiusKm]);

  useEffect(() => {
    if (pos) void fetchNearest();
  }, [pos, fetchNearest]);

  /* marker “Update code” button — MapView calls this with a placeId */
  const handleMarkerUpdateRequested = useCallback(
    (placeId: string) => {
      // try to find by google_place_id first, then by id
      const r = results.find((p) => p.google_place_id === placeId) ?? results.find((p) => p.id === placeId);
      if (!r) return;
      setSelectedPlace({
        place_id: r.google_place_id ?? undefined,
        establishment_id: r.id,
        name: r.name,
        address: r.address ?? null,
        lat: r.lat,
        lng: r.lng,
        code: r.code ?? null,
        code_updated_at: r.code_updated_at ?? null,
      });
      setModalOpen(true);
    },
    [results]
  );

  /* list click -> show center card; also provide “Add code” from the card */
  const handleListClick = useCallback((r: Establishment) => {
    setCenterCard(r);
  }, []);

  const headerTitle = useMemo(() => (!pos ? "Share your location to begin" : `Nearest bathrooms within ${radiusKm} km`), [pos, radiusKm]);

  /* update local list after modal save (optimistic UI) */
  const handleSaved = useCallback(
    (newCode: string | null) => {
      setResults((prev) =>
        prev.map((p) =>
          selectedPlace && (p.id === selectedPlace.establishment_id || p.google_place_id === selectedPlace.place_id)
            ? {
                ...p,
                // interpret empty string as “open access”
                code: newCode ?? null,
                restroom_available: newCode === null ? true : p.restroom_available,
                code_updated_at: new Date().toISOString(),
              }
            : p
        )
      );
      setModalOpen(false);
      setCenterCard((card) =>
        !card || !selectedPlace ? card : card.id === selectedPlace.establishment_id ? { ...card, code: newCode ?? null, code_updated_at: new Date().toISOString() } : card
      );
    },
    [selectedPlace]
  );

  return (
    <>
      <Head>
        <title>glitch</title>
        <meta name="description" content="Bathroom Code Finder" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
        <Header />

        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
          {/* Controls */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs opacity-70">Search radius (km)</label>
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
                  <label className="mb-1 block text-xs opacity-70">Location</label>
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

            {!pos && posStatus === "denied" && <p className="mt-3 text-pink-300">Location permission denied. Enable it and try again.</p>}
            {posStatus === "unavailable" && <p className="mt-3 text-pink-300">Geolocation is not available on this device/browser.</p>}
            {fetchError && <p className="mt-3 text-pink-300">{fetchError}</p>}
          </section>

          {/* Map */}
          {pos && mapEnabled && (
            <div className="mt-5">
              <div className="h-[360px] rounded-2xl border border-slate-800 sm:h-[420px]">
                <MapView center={pos} places={results} onUpdateRequested={handleMarkerUpdateRequested} />
              </div>
            </div>
          )}

          {/* Results list */}
          <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">{headerTitle}</h2>

            {results.length === 0 ? (
              <div className="mt-3 text-sm opacity-75">No places found in range yet. Try a larger radius.</div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-800">
                {results.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          className="block text-left"
                          onClick={() => handleListClick(r)}
                          aria-label={`Show details for ${r.name}`}
                        >
                          <div className="font-semibold">
                            {r.name}{" "}
                            {typeof r.distance_km === "number" && (
                              <span className="ml-2 inline-block rounded-full border border-emerald-800 bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-100">
                                {r.distance_km.toFixed(2)} km
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs opacity-80">{r.address}</div>
                        </button>

                        {r.restroom_available === false ? (
                          <div className="mt-2 text-xs opacity-70">No restroom</div>
                        ) : r.code || r.restroom_available ? (
                          <div className="mt-2">
                            <div className="text-xs opacity-80">Bathroom status</div>
                            {r.restroom_available && !r.code ? (
                              <div className="text-sm">Customer open access</div>
                            ) : (
                              <>
                                <div className="font-mono text-xl">{r.code}</div>
                                {r.code_updated_at && (
                                  <div className="text-xs opacity-70">Updated {new Date(r.code_updated_at).toLocaleString()}</div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs opacity-70">No code yet</div>
                        )}

                        <div className="mt-2 flex gap-3">
                          <button
                            className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
                            onClick={() => {
                              setSelectedPlace({
                                place_id: r.google_place_id ?? undefined,
                                establishment_id: r.id,
                                name: r.name,
                                address: r.address ?? null,
                                lat: r.lat,
                                lng: r.lng,
                                code: r.code ?? null,
                                code_updated_at: r.code_updated_at ?? null,
                              });
                              setModalOpen(true);
                            }}
                          >
                            Add / update code
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        {/* Center “detail” card (appears over content, not full-screen) */}
        {centerCard && (
          <div
            className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/40 p-3"
            onClick={() => setCenterCard(null)}
            role="dialog"
            aria-modal
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            >
              <div className="mb-2 text-xs opacity-70">Selected place</div>
              <div className="text-lg font-semibold">{centerCard.name}</div>
              <div className="text-xs opacity-70">{centerCard.address}</div>

              <div className="mt-3">
                {centerCard.restroom_available === false ? (
                  <div className="text-sm opacity-80">No restroom</div>
                ) : centerCard.code || centerCard.restroom_available ? (
                  <>
                    <div className="text-xs opacity-80">Bathroom status</div>
                    {centerCard.restroom_available && !centerCard.code ? (
                      <div className="text-sm">Customer open access</div>
                    ) : (
                      <>
                        <div className="font-mono text-xl">{centerCard.code}</div>
                        {centerCard.code_updated_at && (
                          <div className="text-xs opacity-70">Updated {new Date(centerCard.code_updated_at).toLocaleString()}</div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-sm opacity-80">No code yet</div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2" onClick={() => setCenterCard(null)}>
                  Close
                </button>
                <button
                  className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium text-emerald-50"
                  onClick={() => {
                    setSelectedPlace({
                      place_id: centerCard.google_place_id ?? undefined,
                      establishment_id: centerCard.id,
                      name: centerCard.name,
                      address: centerCard.address ?? null,
                      lat: centerCard.lat,
                      lng: centerCard.lng,
                      code: centerCard.code ?? null,
                      code_updated_at: centerCard.code_updated_at ?? null,
                    });
                    setModalOpen(true);
                  }}
                >
                  Add / update code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Modal */}
        <UpdateCodeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          place={selectedPlace}
          onSaved={handleSaved}
        />
      </div>
    </>
  );
}
