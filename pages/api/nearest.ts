// pages/api/nearest.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Establishment = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  google_place_id: string | null;
  distance_km?: number;
  code?: string | null;
  code_updated_at?: string | null;
};

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getServiceSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

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

  let supabase: SupabaseClient;
  try {
    supabase = getServiceSupabase();
  } catch (e) {
    console.error("nearest: env error:", e);
    return res.status(500).json({ error: "Server misconfigured (Supabase env)" });
  }

  try {
    // ---------- Path A: use the old view if it exists ----------
    const tryView = await supabase.from("establishments_view").select("*");
    if (!tryView.error && Array.isArray(tryView.data)) {
      const rows = tryView.data as any[];
      const nearbyFromView: Establishment[] = rows
        .map((r) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          restroom_available: r.restroom_available ?? null,
          google_place_id: r.google_place_id ?? null,
          code: r.code ?? null,
          code_updated_at: r.code_updated_at ?? null,
          distance_km: haversineKm(lat, lng, r.lat, r.lng),
        }))
        .filter((r) => (r.distance_km ?? Infinity) <= radius_km)
        .sort((a, b) => (a.distance_km! - b.distance_km!))
        .slice(0, 50);
      return res.status(200).json({ establishments: nearbyFromView });
    }

    // If the view errors because it doesn't exist, log it and fall back.
    if (tryView.error) {
      console.warn("nearest: establishments_view not used:", tryView.error.message);
    }

    // ---------- Path B: establishments + latest codes ----------
    const est = await supabase
      .from("establishments")
      .select("id,name,address,lat,lng,restroom_available,google_place_id");

    if (est.error) {
      console.error("nearest: establishments error:", est.error.message);
      return res.status(500).json({ error: "Failed to read establishments" });
    }

    const all = Array.isArray(est.data) ? est.data : [];
    const nearby = all
      .map((r) => ({
        ...r,
        distance_km: haversineKm(lat, lng, r.lat, r.lng),
      }))
      .filter((r) => (r.distance_km ?? Infinity) <= radius_km)
      .sort((a, b) => (a.distance_km! - b.distance_km!))
      .slice(0, 50) as Establishment[];

    // fetch latest code per establishment in a single pass
    if (nearby.length > 0) {
      const ids = nearby.map((r) => r.id);
      const codes = await supabase
        .from("bathroom_codes")
        .select("establishment_id, code, created_at")
        .in("establishment_id", ids)
        .order("created_at", { ascending: false });

      if (codes.error) {
        // non-fatal: log and still return nearby without codes
        console.warn("nearest: bathroom_codes read error:", codes.error.message);
      } else if (Array.isArray(codes.data)) {
        const latest = new Map<string, { code: string; created_at: string }>();
        for (const row of codes.data) {
          if (!latest.has(row.establishment_id)) {
            latest.set(row.establishment_id, {
              code: row.code,
              created_at: row.created_at,
            });
          }
        }
        nearby.forEach((r) => {
          const l = latest.get(r.id);
          if (l) {
            r.code = l.code;
            r.code_updated_at = l.created_at;
          }
        });
      }
    }

    return res.status(200).json({ establishments: nearby });
  } catch (e) {
    console.error("nearest: unexpected error:", e);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
