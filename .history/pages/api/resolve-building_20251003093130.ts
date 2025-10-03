import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // read is fine with anon, but admin is okay server-side
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const { lat, lng, radius = "100" } = req.query;

    if (!key) return res.status(500).json({ status: "error", error: "Missing GOOGLE_MAPS_API_KEY" });
    if (!lat || !lng) return res.status(400).json({ status: "error", error: "Missing lat/lng" });

    // 1) Ask Google what’s here
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius)); // meters; try 60–150
    url.searchParams.set("key", key);
    url.searchParams.set("type", "establishment"); // broad bucket of businesses

    const gRes = await fetch(url.toString());
    const gJson = await gRes.json();

    if (gJson.status !== "OK" && gJson.status !== "ZERO_RESULTS") {
      return res.status(502).json({ status: "error", error: "Places API failed", details: gJson });
    }

    const candidates: Array<{
      place_id: string;
      name: string;
      address?: string | null;
      lat: number | null;
      lng: number | null;
      // Supabase-merged
      code?: string | null;
      code_updated_at?: string | null;
      restroom_available?: boolean | null;
      staff_verified?: boolean | null;
    }> = (gJson.results || []).slice(0, 5).map((p: any) => ({
      place_id: p.place_id,
      name: p.name,
      address: p.vicinity || p.formatted_address || null,
      lat: p.geometry?.location?.lat ?? null,
      lng: p.geometry?.location?.lng ?? null,
    }));

    if (candidates.length === 0) {
      return res.status(200).json({ status: "ok", count: 0, candidates: [] });
    }

    // 2) Merge Supabase code info by google_place_id
    const placeIds = candidates.map(c => c.place_id);
    const { data: rows, error } = await supabaseAdmin
      .from("establishments")
      .select("google_place_id, code, code_updated_at, restroom_available, staff_verified")
      .in("google_place_id", placeIds);

    if (error) {
      // don’t fail the endpoint—just return Places-only
      console.error("Supabase select error:", error.message);
    }

    const byId = new Map((rows || []).map(r => [r.google_place_id, r]));
    const merged = candidates.map(c => {
      const m = byId.get(c.place_id);
      return m
        ? { ...c,
            code: m.code,
            code_updated_at: m.code_updated_at,
            restroom_available: m.restroom_available,
            staff_verified: m.staff_verified
          }
        : c;
    });

    return res.status(200).json({
      status: "ok",
      count: merged.length,
      candidates: merged
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ status: "error", error: e?.message || "unknown" });
  }
}

// Force Node runtime (Edge has no process.env by default)
export const config = { api: { bodyParser: false } };
