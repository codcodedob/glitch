// pages/api/resolve-building.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResolveEst = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id?: string | null;
};

type Candidate = {
  place_id: string | null;
  name: string;
  address?: string | null;
  lat?: number;
  lng?: number;
  code?: string | null;
  code_updated_at?: string | null;
  code_staff_verified?: boolean | null;
};

type Resp =
  | {
      status: "code";
      establishment: ResolveEst;
      code: string;
      code_updated_at?: string | null;
      code_staff_verified?: boolean | null;
      code_reports_24h?: number;
      candidates?: Candidate[];
    }
  | {
      status: "no_code" | "no_restroom" | "not_found" | "error";
      error?: string;
      establishment?: ResolveEst;
      candidates?: Candidate[];
    };

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = (Math.PI / 180) * (bLat - aLat);
  const dLng = (Math.PI / 180) * (bLng - aLng);
  const la1 = (Math.PI / 180) * aLat;
  const la2 = (Math.PI / 180) * bLat;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "GET") return res.status(405).json({ status: "error", error: "Method not allowed" });

  try {
    const lat = parseFloat(String(req.query.lat ?? ""));
    const lng = parseFloat(String(req.query.lng ?? ""));
    const radiusMeters = parseFloat(String(req.query.radius ?? "120"));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ status: "error", error: "Missing lat/lng" });

    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server only
    if (!url || !serviceKey) return res.status(500).json({ status: "error", error: "Server misconfigured" });
    const supabase = createClient(url, serviceKey);

    // Pull a small set (you could filter at SQL with a geo index if you have one)
    const { data: rows, error } = await supabase
      .from("establishments_view")
      .select("*");
    if (error) throw error;

    const arr = Array.isArray(rows) ? rows : [];
    if (!arr.length) return res.status(200).json({ status: "not_found", candidates: [] });

    // compute distance + find closest
    const withDist = arr.map((r: any) => ({
      ...r,
      _dist_m: haversineMeters(lat, lng, r.lat, r.lng),
    }));
    withDist.sort((a, b) => a._dist_m - b._dist_m);

    const closest = withDist[0];
    if (!closest || closest._dist_m > radiusMeters) {
      // provide top 5 as “candidates”
      const candidates: Candidate[] = withDist.slice(0, 5).map((r: any) => ({
        place_id: r.google_place_id ?? null,
        name: r.name,
        address: r.address ?? null,
        lat: r.lat,
        lng: r.lng,
        code: r.code ?? null,
        code_updated_at: r.code_updated_at ?? null,
        code_staff_verified: r.code_staff_verified ?? null,
      }));
      return res.status(200).json({ status: "not_found", candidates });
    }

    const establishment: ResolveEst = {
      id: closest.id,
      name: closest.name,
      address: closest.address ?? null,
      lat: closest.lat,
      lng: closest.lng,
      google_place_id: closest.google_place_id ?? null,
    };

    // Count 24h reports for this establishment
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: repRows, error: repErr } = await supabase
      .from("code_issue_reports")
      .select("id")
      .eq("establishment_id", closest.id)
      .gte("created_at", sinceIso);
    if (repErr) throw repErr;

    // Decide status
    if (closest.restroom_available === false) {
      return res.status(200).json({
        status: "no_restroom",
        establishment,
        candidates: withDist.slice(1, 6).map((r: any) => ({
          place_id: r.google_place_id ?? null,
          name: r.name,
          address: r.address ?? null,
          lat: r.lat,
          lng: r.lng,
          code: r.code ?? null,
          code_updated_at: r.code_updated_at ?? null,
          code_staff_verified: r.code_staff_verified ?? null,
        })),
      });
    }

    if (closest.code) {
      return res.status(200).json({
        status: "code",
        establishment,
        code: closest.code,
        code_updated_at: closest.code_updated_at ?? null,
        code_staff_verified: closest.code_staff_verified ?? null,
        code_reports_24h: (repRows ?? []).length,
        candidates: withDist.slice(1, 6).map((r: any) => ({
          place_id: r.google_place_id ?? null,
          name: r.name,
          address: r.address ?? null,
          lat: r.lat,
          lng: r.lng,
          code: r.code ?? null,
          code_updated_at: r.code_updated_at ?? null,
          code_staff_verified: r.code_staff_verified ?? null,
        })),
      });
    }

    return res.status(200).json({
      status: "no_code",
      establishment,
      candidates: withDist.slice(1, 6).map((r: any) => ({
        place_id: r.google_place_id ?? null,
        name: r.name,
        address: r.address ?? null,
        lat: r.lat,
        lng: r.lng,
        code: r.code ?? null,
        code_updated_at: r.code_updated_at ?? null,
        code_staff_verified: r.code_staff_verified ?? null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resolve failed";
    return res.status(200).json({ status: "error", error: msg });
  }
}
