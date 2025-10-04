// pages/index.tsx
import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import UpdateCodeModal from "@/components/UpdateCodeModal";

/* ---------- App Types ---------- */

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

type ResolveEstablishment = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id?: string | null;
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
  | {
      status: "code";
      establishment: ResolveEstablishment;
      code: string;
      code_updated_at?: string | null;
      candidates?: ResolveCandidate[];
      error?: never;
    }
  | {
      status: "no_code" | "no_restroom" | "not_found";
      establishment?: ResolveEstablishment;
      code?: null;
      code_updated_at?: string | null;
      candidates?: ResolveCandidate[];
      error?: never;
    }
  | {
      status: "error";
      error: string;
      establishment?: ResolveEstablishment;
      candidates?: ResolveCandidate[];
      code?: null;
      code_updated_at?: string | null;
    };

type Candidate = {
  place_id?: string; // optional if we only have establishment_id
  establishment_id?: string; // optional if we have place_id
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
  code_updated_at?: string | null;
};

/* ---------- Map (client-only) ---------- */

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

/* ---------- Page ---------- */

export default function Home() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posStatus, setPosStatus] = useState<
    "idle" | "prompting" | "granted" | "denied" | "unavailable"
  >("idle");

  const [radiusKm, setRadiusKm] = useState<number>(0.5);
  const [results, setResults] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Places-based modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Candidate | null>(null);

  const inFlight = useRef(false);

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
      const res = await fetch(`/api/nearest?${q.toString()}`, {
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as NearestResp;
      setResults(data.establishments ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch nearby places.";
      setFetchError(msg);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [pos, radiusKm]);

  useEffect(() => {
    if (pos) fetchNearest();
  }, [pos, fetchNearest]);

  // Auto-resolve toast flow
  useEffect(() => {
    if (!pos) return;
    (async () => {
      try {
        const q = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng) });
        const r = await fetch(`/api/resolve-building?${q.toString()}`);
        const data = (await r.json()) as ResolveResponse;

        if (data.status === "code") {
          toast.success(`🧻 ${data.establishment.name} — code: ${data.code}`, { duration: 6000 });
          return;
        }

        if (data.status === "no_code") {
          toast(
            (t) => (
              <div className="text-sm">
                <div>✍️ {data.establishment?.name || "This place"} — no code yet</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                    onClick={() => {
                      const base: Candidate = {
                        place_id: data.establishment?.google_place_id ?? undefined,
                        establishment_id: data.establishment?.id ?? undefined,
                        name: data.establishment?.name ?? "This place",
                        address: data.establishment?.address ?? null,
                        lat: data.establishment?.lat ?? pos.lat,
                        lng: data.establishment?.lng ?? pos.lng,
                        code: null,
                        code_updated_at: null,
                      };
                      setSelectedPlace(base);
                      setModalOpen(true);
                      toast.dismiss(t.id);
                    }}
                  >
                    Add code
                  </button>

                  <button
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                    onClick={async () => {
                      const q2 = new URLSearchParams({
                        lat: String(pos.lat),
                        lng: String(pos.lng),
                        radius: "120",
                      });
                      const r2 = await fetch(`/api/resolve-building?${q2.toString()}`);
                      const j = (await r2.json()) as ResolveResponse;

                      const rawChoices = Array.isArray(j.candidates) ? j.candidates : [];
                      const choices: Candidate[] = rawChoices.map((p) => ({
                        place_id: p.place_id,
                        name: p.name,
                        address: p.address ?? null,
                        lat: p.lat ?? pos.lat,
                        lng: p.lng ?? pos.lng,
                        code: p.code ?? null,
                        code_updated_at: p.code_updated_at ?? null,
                      }));

                      if (!choices.length) {
                        toast("No other nearby places found", { id: t.id, duration: 3000 });
                        return;
                      }

                      toast.custom(
                        (tt) => (
                          <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-3 text-sm shadow-2xl">
                            <div className="mb-2 font-medium">Pick the correct place</div>
                            <div className="flex flex-col gap-2">
                              {choices.slice(0, 5).map((p) => (
                                <button
                                  key={p.place_id}
                                  className="text-left rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                                  onClick={() => {
                                    setSelectedPlace(p);
                                    setModalOpen(true);
                                    toast.dismiss(tt.id);
                                    toast.dismiss(t.id);
                                  }}
                                >
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs opacity-70">{p.address ?? "No address"}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                        { id: `${t.id}-chooser`, duration: 10000 }
                      );
                    }}
                  >
                    Not this place?
                  </button>
                </div>
              </div>
            ),
            { duration: 6000 }
          );
          return;
        }

        if (data.status === "no_restroom") {
          toast(`🚫 ${data.establishment?.name || "This place"} — no restroom`, { duration: 4500 });
        }
      } catch {
        // ignore network errors
      }
    })();
  }, [pos, fetchNearest]);

  // Shared handler so list rows use the same flow
  const handleUpdateClickFromRow = useCallback(
    async (r: Establishment, posNow: { lat: number; lng: number } | null) => {
      if (r.google_place_id) {
        setSelectedPlace({
          place_id: r.google_place_id,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          code: r.code ?? null,
          code_updated_at: r.code_updated_at ?? null,
        });
        setModalOpen(true);
        return;
      }

      const lat = r.lat ?? posNow?.lat;
      const lng = r.lng ?? posNow?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") {
        toast.error("No coordinates for this place.");
        return;
      }

      try {
        const q = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: "120" });
        const res = await fetch(`/api/resolve-building?${q.toString()}`);
        const data = (await res.json()) as ResolveResponse;

        if (data.establishment) {
          setSelectedPlace({
            place_id: data.establishment.google_place_id ?? undefined,
            establishment_id: data.establishment.id ?? undefined,
            name: data.establishment.name,
            address: data.establishment.address ?? null,
            lat: data.establishment.lat ?? lat,
            lng: data.establishment.lng ?? lng,
            code: data.status === "code" ? data.code ?? null : null,
            code_updated_at: data.code_updated_at ?? null,
          });
          setModalOpen(true);
          return;
        }

        const rawChoices = Array.isArray(data.candidates) ? data.candidates : [];
        const choices: Candidate[] = rawChoices.map((p) => ({
          place_id: p.place_id,
          name: p.name,
          address: p.address ?? null,
          lat: p.lat ?? lat,
          lng: p.lng ?? lng,
          code: p.code ?? null,
          code_updated_at: p.code_updated_at ?? null,
        }));

        if (!choices.length) {
          setSelectedPlace({
            establishment_id: r.id,
            name: r.name,
            address: r.address ?? null,
            lat: r.lat ?? lat,
            lng: r.lng ?? lng,
            code: r.code ?? null,
            code_updated_at: r.code_updated_at ?? null,
          });
          setModalOpen(true);
          return;
        }

        toast.custom(
          (tt) => (
            <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-3 text-sm shadow-2xl">
              <div className="mb-2 font-medium">Pick the correct place</div>
              <div className="flex flex-col gap-2">
                {choices.slice(0, 5).map((p) => (
                  <button
                    key={p.place_id}
                    className="text-left rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                    onClick={() => {
                      setSelectedPlace(p);
                      setModalOpen(true);
                      toast.dismiss(tt.id);
                    }}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-70">{p.address ?? "No address"}</div>
                  </button>
                ))}
              </div>
            </div>
          ),
          { duration: 10000 }
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not fetch nearby candidates";
        toast.error(msg);
      }
    },
    []
  );

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

      <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
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

            {!pos && posStatus === "denied" && (
              <p className="mt-3 text-pink-300">
                Location permission denied. Enable it in your browser settings and try again.
              </p>
            )}
            {posStatus === "unavailable" && (
              <p className="mt-3 text-pink-300">Geolocation is not available on this device/browser.</p>
            )}
            {fetchError && <p className="mt-3 text-pink-300">{fetchError}</p>}
          </div>

          {/* Map */}
          {pos && (
            <div className="mt-5">
              <div className="h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-800">
                <MapView center={pos} places={results} />
              </div>
            </div>
          )}

          {/* Results list */}
          <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">{header}</h2>

            {results.length === 0 ? (
              <div className="mt-3 text-sm opacity-75">
                No places found in range yet. Try a larger radius.
              </div>
            ) : null}

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

                      {r.restroom_available === false ? (
                        <div className="mt-2 text-xs opacity-70">No restroom</div>
                      ) : r.code ? (
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
                        <div className="mt-2 text-xs opacity-70">No code yet</div>
                      )}

                      <div className="mt-2">
                        <button
                          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
                          onClick={() => handleUpdateClickFromRow(r, pos)}
                        >
                          Update code
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Modal */}
          <UpdateCodeModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            place={selectedPlace}
            onSaved={async () => {
              toast.success("Code updated");
              setModalOpen(false);
              await fetchNearest();
            }}
          />

          <footer className="mt-8 text-center text-xs opacity-60">
            Crowd-sourced codes. Please be respectful and follow venue policies.
          </footer>
        </div>
      </div>
    </>
  );
}
