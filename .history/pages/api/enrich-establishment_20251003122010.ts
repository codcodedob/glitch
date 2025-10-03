import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!GOOGLE_KEY) return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });

  const { establishment_id } = req.body as { establishment_id?: string };
  if (!establishment_id) return res.status(400).json({ error: "Missing establishment_id" });

  const { data: row, error: getErr } = await supabase
    .from("establishments")
    .select("id,name,address,lat,lng,google_place_id,code,code_updated_at")
    .eq("id", establishment_id)
    .single();

  if (getErr || !row) return res.status(404).json({ error: "Establishment not found" });
  if (row.google_place_id) {
    // Already enriched
    return res.status(200).json({ updated: false, establishment: row });
  }

  // Query Google Places Nearby (rank by distance in a small radius)
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${row.lat},${row.lng}`);
  url.searchParams.set("radius", "60");
  url.searchParams.set("type", "establishment");
  url.searchParams.set("key", GOOGLE_KEY);

  const g = await fetch(url.toString()).then((r) => r.json());
  if (g.status !== "OK" || !g.results?.length) {
    return res.status(200).json({ updated: false, establishment: row, note: "No nearby place found" });
  }

  // Choose the nearest result
  const first = g.results[0];
  const newName = first.name as string;
  const placeId = first.place_id as string;

  const { data: up, error: upErr } = await supabase
    .from("establishments")
    .update({ name: newName, google_place_id: placeId })
    .eq("id", establishment_id)
    .select("*")
    .single();

  if (upErr) return res.status(500).json({ error: upErr.message });
  return res.status(200).json({ updated: true, establishment: up });
}
