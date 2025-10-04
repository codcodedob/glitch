// pages/api/nearby-places.ts
import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

/** Minimal shape we need from Google Places Nearby Search */
type GoogleNearbyPlace = {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
};

type GoogleNearbyResponse = {
  results: GoogleNearbyPlace[];
  status: string;
  error_message?: string;
};

/** What we return to the client */
export type NearbyPlacesApiResponse =
  | { status: "ok"; places: Array<{ place_id: string; name: string; address: string; lat: number; lng: number }> }
  | { status: "error"; error: string };

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function coerceNumber(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toAddress(p: GoogleNearbyPlace): string {
  return p.vicinity ?? p.formatted_address ?? "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NearbyPlacesApiResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", error: "Method not allowed" });
  }

  if (!GOOGLE_KEY) {
    return res.status(500).json({ status: "error", error: "Missing GOOGLE_MAPS_API_KEY" });
  }

  // required: lat/lng
  const lat = coerceNumber(req.query.lat);
  const lng = coerceNumber(req.query.lng);
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return res.status(400).json({ status: "error", error: "Invalid or missing lat/lng" });
  }

  // optional: radius (meters), keyword, type, limit
  const radiusMeters = (() => {
    const n = coerceNumber(req.query.radius);
    // default to ~120m (tight building/corner resolution)
    if (!isFiniteNumber(n)) return 120;
    // clamp 20m..1500m to avoid overly large queries
    return Math.max(20, Math.min(1500, n));
  })();

  const keyword = typeof req.query.keyword === "string" ? req.query.keyword : undefined;
  const gType = typeof req.query.type === "string" ? req.query.type : "establishment";
  const limit = (() => {
    const n = coerceNumber(req.query.limit);
    if (!isFiniteNumber(n)) return 5;
    return Math.max(1, Math.min(10, n));
  })();

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("type", gType);
    if (keyword) url.searchParams.set("keyword", keyword);
    url.searchParams.set("key", GOOGLE_KEY);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      return res
        .status(502)
        .json({ status: "error", error: `Google Places error ${resp.status}` });
    }

    const data: unknown = await resp.json();
    // Narrow the type carefully
    const g = data as GoogleNearbyResponse;

    if (!g || !Array.isArray(g.results)) {
      return res
        .status(502)
        .json({ status: "error", error: "Unexpected response from Google Places" });
    }

    if (g.status !== "OK" && g.status !== "ZERO_RESULTS") {
      const msg = g.error_message ? `: ${g.error_message}` : "";
      return res
        .status(502)
        .json({ status: "error", error: `Google Places status ${g.status}${msg}` });
    }

    const places = g.results.slice(0, limit).map((p) => {
      const loc = p.geometry?.location ?? { lat, lng };
      return {
        place_id: p.place_id,
        name: p.name,
        address: toAddress(p) || "Address unavailable",
        lat: loc.lat,
        lng: loc.lng,
      };
    });

    return res.status(200).json({ status: "ok", places });
  } catch (e: unknown) {
    const err = e as Error;
    return res
      .status(500)
      .json({ status: "error", error: err.message || "Failed to fetch nearby places" });
  }
}
