// pages/index.tsx
import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import UpdateCodeModal from "@/components/UpdateCodeModal";

type Establishment = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  distance_km?: number;
  code?: string | null;
  code_updated_at?: string | null;
  // may be absent for /api/nearest rows:
  google_place_id?: string | null;
};

type Candidate = {
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  code?: string | null;
  code_updated_at?: string | null;
};

// Vanilla Leaflet map (no react-leaflet)
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

  // Inline quick-edit (by establishment_id) for list rows:
  const [quickEdit, setQuickEdit] = useState<{ id: string; name: string } | null>(null);

  // Modal (by google place_id) for Places-based detection/chooser:
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Candidate | null>(null);

  const staffToken = process.env.NEXT_PUBLIC_SUBMIT_TOKEN; // dev-only toggle for staff_verified
  const inFlight = useRef(false);
  async function handleUpdateClickFromRow(row: Establishment, posNow: {lat:number;lng:number} | null) {
    // If we already know the place_id for this row → open modal directly
    if (row.google_place_id) {
      setSelectedPlace({
        place_id: row.google_place_id,
        name: row.name,
        address: row.address ?? null,
        lat: row.lat,
        lng: row.lng,
        code: row.code ?? null,
        code_updated_at: row.code_updated_at ?? null,
      });
      setModalOpen(true);
      return;
    }
  
    // Otherwise, ask resolve API for candidates near the row’s coords
    const lat = row.lat ?? posNow?.lat;
    const lng = row.lng ?? posNow?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      toast.error("No coordinates for this place.");
      return;
    }
    try {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: "120" });
      const r = await fetch(`/api/resolve-building?${q.toString()}`);
      const j = await r.json();
  
      // If resolve returns a single establishment w/ place_id and no code → open modal directly
      if (j?.establishment?.google_place_id) {
        setSelectedPlace({
          place_id: j.establishment.google_place_id,
          name: j.establishment.name,
          address: j.establishment.address ?? null,
          lat: j.establishment.lat,
          lng: j.establishment.lng,
          code: j.code ?? null,
          code_updated_at: j.code_updated_at ?? null,
        });
        setModalOpen(true);
        return;
      }
  
      // Else show the same chooser you already use in the toast flow
      const choices: Candidate[] =
        j?.candidates?.map((p: any) => ({
          place_id: p.place_id,
          name: p.name,
          address: p.address ?? null,
          lat: p.lat ?? lat,
          lng: p.lng ?? lng,
          code: p.code ?? null,
          code_updated_at: p.code_updated_at ?? null,
        })) ?? [];
  
      if (!choices.length) {
        toast("No nearby candidates found", { duration: 3000 });
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
    } catch (e: any) {
      toast.error(e?.message ?? "Could not fetch nearby candidates");
    }
  }
  
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
      const data = (await res.json()) as { establishments?: Establishment[] };
      setResults(data.establishments ?? []);
    } catch (e: any) {
      setFetchError(e?.message ?? "Failed to fetch nearby places.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [pos, radiusKm]);

  // fetch when position arrives
  
  useEffect(() => {
    if (pos) fetchNearest();
  }, [pos, fetchNearest]);

  

  // Auto-resolve building and toast (now wires to modal for adding code)
  useEffect(() => {
    if (!pos) return;
    (async () => {
      try {
        const q = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng) });
        const r = await fetch(`/api/resolve-building?${q.toString()}`);
        const data = await r.json();

        if (data.status === "code") {
          toast.success(`🧻 ${data.establishment.name} — code: ${data.code}`, { duration: 6000 });
        } else if (data.status === "no_code") {
          // Prepare the candidate for the modal
          const baseCand: Candidate | null = data.establishment?.google_place_id
            ? {
                place_id: data.establishment.google_place_id,
                name: data.establishment.name,
                address: data.establishment.address,
                lat: data.establishment.lat,
                lng: data.establishment.lng,
                code: data.code ?? null,
                code_updated_at: data.code_updated_at ?? null,
              }
            : null;

          toast(
            (t) => (
              <div className="text-sm">
                <div>✍️ {data.establishment?.name || "This place"} — no code yet</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                    onClick={() => {
                      if (baseCand) {
                        setSelectedPlace(baseCand);
                        setModalOpen(true);
                        toast.dismiss(t.id);
                      } else {
                        toast("No place_id yet—try chooser", { id: t.id, duration: 3000 });
                      }
                    }}
                  >
                    Add code
                  </button>

                  <button
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                    onClick={async () => {
                      // Show top nearby choices
                      const q2 = new URLSearchParams({
                        lat: String(pos!.lat),
                        lng: String(pos!.lng),
                        radius: "120",
                      });
                      const r2 = await fetch(`/api/resolve-building?${q2.toString()}`);
                      const j = await r2.json();

                      const choices: Candidate[] =
                        j?.candidates?.map((p: any) => ({
                          place_id: p.place_id,
                          name: p.name,
                          address: p.address ?? null,
                          lat: p.lat ?? pos!.lat,
                          lng: p.lng ?? pos!.lng,
                          code: p.code ?? null,
                          code_updated_at: p.code_updated_at ?? null,
                        })) ?? [];

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
        } else if (data.status === "no_restroom") {
          toast(`🚫 ${data.establishment?.name || "This place"} — no restroom`, { duration: 4500 });
        }
      } catch {
        // ignore
      }
    })();
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
              <MapView center={pos} places={results} />
            </div>
          )}

          {/* Results list with empty state directly under header */}
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
                        {/* List updates still use establishment_id quick-edit */}
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

            {/* Tailwind sanity chip */}
            <div className="mt-4 inline-block rounded-xl bg-emerald-600 px-3 py-1 text-white">
              Tailwind is working ✅
            </div>
          </section>

          {/* Quick-edit floating form (establishment_id) */}
          {quickEdit && (
            <form
              className="fixed inset-x-0 top-20 z-[9998] mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-4 backdrop-blur-md shadow-2xl"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const code = (form.elements.namedItem("code") as HTMLInputElement).value.trim();
                const staffBox = form.elements.namedItem("staff_verified") as HTMLInputElement | null;
                if (!code) return;
                try {
                  const res = await fetch("/api/submit", {
                    method: "POST",
                    headers: {
                      "content-type": "application/json",
                      ...(staffToken ? { "x-submit-token": staffToken } : {}),
                    },
                    body: JSON.stringify({
                      establishment_id: quickEdit.id, // server should handle this path too
                      code,
                      staff_verified: !!staffBox?.checked,
                    }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok || j?.error) throw new Error(j?.error || "Submit failed");
                  toast.success("Code saved");
                  setQuickEdit(null);
                  await fetchNearest();
                } catch (err: any) {
                  toast.error(err?.message || "Submit failed — check console");
                  console.error(err);
                }
              }}
            >
              <div className="text-sm mb-2 font-medium">Update code — {quickEdit.name}</div>
              <input
                name="code"
                autoFocus
                placeholder="Enter code"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 font-mono tracking-widest"
              />
              {staffToken && (
                <label className="mt-2 flex items-center gap-2 text-xs opacity-80">
                  <input type="checkbox" name="staff_verified" /> Staff-verified
                </label>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 hover:bg-slate-700"
                  type="submit"
                >
                  Save
                </button>
                <button
                  className="rounded-xl border border-slate-800 px-4 py-2"
                  type="button"
                  onClick={() => setQuickEdit(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Modal for Places-based add/update (by place_id) */}
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
