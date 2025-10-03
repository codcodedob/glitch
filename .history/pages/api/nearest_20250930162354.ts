import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type EstablishmentRow = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  restroom_available: boolean | null;
  code: string | null;
  code_updated_at: string | null;
};

function toRad(x: number) { return (x * Math.PI) / 180; }
function haversineKm(a: {lat:number;lng:number}, b:{lat:number;lng:number}) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const DEMO = [
  { id: "1", name: "Starbucks", address: "9 W 32nd St, New York, NY 10001", lat: 40.74774, lng: -73.98642, restroom_available: true,  code: "1234", code_updated_at: new Date().toISOString() },
  { id: "2", name: "Pret A Manger", address: "1165 Broadway, New York, NY 10001", lat: 40.74496, lng: -73.98829, restroom_available: true,  code: null,   code_updated_at: null },
  { id: "3", name: "Tiny Kiosk",   address: "Corner stand",                         lat: 40.74640, lng: -73.98850, restroom_available: false, code: null,   code_updated_at: null },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = Math.max(0.1, Math.min(10, Number(req.query.radius_km ?? 0.5)));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: "Invalid lat/lng" });

  const here = { lat, lng };

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) throw new Error("Supabase env not set");

    const supabase = createClient(url, anon);

    const latDelta = radiusKm / 111.12;
    const lngDelta = radiusKm / (111.12 * Math.cos((lat * Math.PI) / 180));
    const minLat = lat - latDelta, maxLat = lat + latDelta;
    const minLng = lng - lngDelta, maxLng = lng + lngDelta;

    const { data, error } = await supabase
      .from("establishments_view")
      .select("*")
      .gte("lat", minLat).lte("lat", maxLat)
      .gte("lng", minLng).lte("lng", maxLng)
      .limit(100);

    if (error) throw error;

    const rows = (data ?? []) as EstablishmentRow[];
    const results = rows
      .map((p) => ({ ...p, distance_km: haversineKm(here, { lat: p.lat, lng: p.lng }) }))
      .filter((p) => p.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20);

    if (results.length > 0) {
      return res.status(200).json({ establishments: results });
    }
  } catch {
    // fall back to demo
  }

  const demoResults = DEMO
    .map((p) => ({ ...p, distance_km: haversineKm(here, { lat: p.lat, lng: p.lng }) }))
    .filter((p) => p.distance_km <= radiusKm)
    .sort((a, b) => (a.distance_km! - b.distance_km!))
    .slice(0, 20);

  return res.status(200).json({ establishments: demoResults });
}
