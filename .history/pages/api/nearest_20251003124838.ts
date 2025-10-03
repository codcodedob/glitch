// pages/api/nearest.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Establishment = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  code: string | null;
  code_updated_at: string | null;
  google_place_id: string | null;
  distance_km?: number;
};

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = (Math.PI / 180) * (bLat - aLat);
  const dLng = (Math.PI / 180) * (bLng - aLng);
  const la1 = (Math.PI / 180) * aLat;
  const la2 = (Math.PI / 180) * bLat;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ establishments: Establishment[] } | { error: string }>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius_km = Number(req.query.radius_km ?? 0.5);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius_km)) {
    return res.status(400).json({ error: "Invalid lat/lng/radius_km" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Missing Supabase server env" });
  }
  if (!GOOGLE_KEY) {
    // we can still return Supabase-only results if present
    console.warn("Missing GOOGLE_MAPS_API_KEY; nearest will not backfill from Google.");
  }

  // 1) Pull from Supabase view/table first
  const { data: rows, error } = await supabase
    .from("establishments_view") // or "establishments" if you don't have the view
    .select("*");
  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  // Filter in-memory by radius and sort
  let nearby: Establishment[] =
    (rows ?? [])
      .map((r: any) => {
        const d = haversineKm(lat, lng, r.lat, r.lng);
        return { ...r, distance_km: d } as Establishment;
      })
      .filter((r) => (r.distance_km ?? Infinity) <= radius_km)
      .sort((a, b) => (a.distance_km! - b.distance_km!));

  // 2) If too few results, backfill from Google Places and upsert to Supabase
  const MIN_RESULTS = 6;
  if (nearby.length < MIN_RESULTS && GOOGLE_KEY) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("radius", String(Math.max(50, Math.round(radius_km * 1000))));
      url.searchParams.set("type", "establishment");
      url.searchParams.set("key", GOOGLE_KEY);

      const g = await fetch(url.toString()).then((r) => r.json());
      const places: any[] = g?.results ?? [];

      // Upsert any new places
      for (const p of places) {
        const placeId = p.place_id as string | undefined;
        const name = (p.name as string) ?? "Unknown place";
        const address = (p.vicinity as string) ?? (p.formatted_address as string) ?? name;
        const loc = p.geometry?.location;
        const plat = Number(loc?.lat ?? lat);
        const plng = Number(loc?.lng ?? lng);

        if (!placeId) continue;

        await supabase
          .from("establishments")
          .upsert(
            {
              google_place_id: placeId,
              name,
              address,
              lat: plat,
              lng: plng,
            },
            { onConflict: "google_place_id" }
          );
      }

      // Re-read and recompute “nearby”
      const { data: rows2 } = await supabase.from("establishments_view").select("*");
      nearby =
        (rows2 ?? [])
          .map((r: any) => {
            const d = haversineKm(lat, lng, r.lat, r.lng);
            return { ...r, distance_km: d } as Establishment;
          })
          .filter((r) => (r.distance_km ?? Infinity) <= radius_km)
          .sort((a, b) => (a.distance_km! - b.distance_km!));
    } catch (e: any) {
      console.error("Google backfill failed:", e?.message || e);
    }
  }

  // 3) Return (de-dup + cap)
  const seen = new Set<string>();
  const deduped: Establishment[] = [];
  for (const r of nearby) {
    const key = r.google_place_id || r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
    if (deduped.length >= 25) break;
  }

  return res.status(200).json({ establishments: deduped });
}
