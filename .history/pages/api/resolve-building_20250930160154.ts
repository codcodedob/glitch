// pages/api/resolve-building.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResolveRes = {
  status: "code" | "no_code" | "no_restroom" | "not_found" | "error";
  establishment?: {
    id: string; name: string; address: string; lat: number; lng: number; google_place_id?: string | null;
  };
  code?: string | null;
  code_updated_at?: string | null;
  error?: string;
};

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;

async function googleNearby(lat: number, lng: number) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "50"); // 50m bubble
  url.searchParams.set("type", "establishment");
  url.searchParams.set("key", GOOGLE_KEY);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Google nearby ${r.status}`);
  return r.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResolveRes>) {
  if (req.method !== "GET") return res.status(405).json({ status: "error", error: "Method not allowed" });
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ status: "error", error: "Invalid lat/lng" });
  if (!GOOGLE_KEY) return res.status(500).json({ status: "error", error: "Missing GOOGLE_MAPS_API_KEY" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  try {
    const nearby = await googleNearby(lat, lng);
    const first = nearby?.results?.[0];
    if (!first) return res.status(200).json({ status: "not_found" });

    const placeId: string = first.place_id;
    const name: string = first.name;
    const loc = first.geometry?.location;
    const address: string = first.vicinity || first.formatted_address || name;

    // Upsert by google_place_id, so the same building stays a single row
    const { data: est, error: upErr } = await supabase
      .from("establishments")
      .upsert({
        google_place_id: placeId,
        name,
        address,
        lat: loc?.lat ?? lat,
        lng: loc?.lng ?? lng,
      }, { onConflict: "google_place_id" })
      .select("*")
      .single();
    if (upErr) throw upErr;

    // Pull latest code via the view
    const { data: row, error: vErr } = await supabase
      .from("establishments_view")
      .select("*")
      .eq("id", est.id)
      .single();
    if (vErr) throw vErr;

    let status: ResolveRes["status"] = "no_code";
    if (row.restroom_available === false) status = "no_restroom";
    if (row.code) status = "code";

    return res.status(200).json({
      status,
      establishment: { id: row.id, name: row.name, address: row.address, lat: row.lat, lng: row.lng, google_place_id: placeId },
      code: row.code,
      code_updated_at: row.code_updated_at,
    });
  } catch (e: any) {
    return res.status(200).json({ status: "error", error: e?.message || "resolve failed" });
  }
}
