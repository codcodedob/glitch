import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;

type PlaceLite = {
  name: string;
  place_id: string;
  lat: number;
  lng: number;
  address: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: "Invalid lat/lng" });
  if (!GOOGLE_KEY) return res.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });

  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "75");
  url.searchParams.set("type", "establishment");
  url.searchParams.set("key", GOOGLE_KEY);

  const r = await fetch(url.toString());
  const json = await r.json();
  const results: PlaceLite[] = (json?.results ?? []).slice(0, 3).map((p: any) => ({
    name: p.name,
    place_id: p.place_id,
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    address: p.vicinity || p.formatted_address || p.name,
  }));

  return res.status(200).json({ places: results });
}
