import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, type PostgrestSingleResponse } from "@supabase/supabase-js";

type ResolveStatus = "code" | "no_code" | "no_restroom" | "not_found" | "error";

type EstablishmentRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id: string | null;
  restroom_available: boolean | null;
  code: string | null;
  code_updated_at: string | null;
  staff_verified: boolean | null;
};

type ResolveRes =
  | { status: Extract<ResolveStatus, "error">; error: string }
  | {
      status: Exclude<ResolveStatus, "error">;
      establishment?: {
        id: string;
        name: string;
        address: string | null;
        lat: number;
        lng: number;
        google_place_id?: string | null;
      };
      code?: string | null;
      code_updated_at?: string | null;
    };

type GoogleNearbyResult = {
  results: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  }>;
  status: "OK" | "ZERO_RESULTS" | string;
  error_message?: string;
};

type GoogleDetailsResult = {
  result?: {
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  };
  status: "OK" | "ZERO_RESULTS" | string;
  error_message?: string;
};

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,             // server-only
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

async function googleNearby(lat: number, lng: number, radius = 80): Promise<GoogleNearbyResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius));    // meters
  url.searchParams.set("type", "establishment");
  url.searchParams.set("key", GOOGLE_KEY!);

  const resp = await fetch(url.toString());
  const json = (await resp.json()) as GoogleNearbyResult;
  return json;
}

async function googlePlaceDetails(placeId: string): Promise<GoogleDetailsResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", GOOGLE_KEY!);

  const resp = await fetch(url.toString());
  const json = (await resp.json()) as GoogleDetailsResult;
  return json;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResolveRes>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", error: "Method not allowed" });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const forcePlaceId = typeof req.query.place_id === "string" ? req.query.place_id : null;

  if (!GOOGLE_KEY) return res.status(500).json({ status: "error", error: "Missing GOOGLE_MAPS_API_KEY" });
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ status: "error", error: "Invalid lat/lng" });
  }

  try {
    // 1) Get the top candidate from Google
    let candidate:
      | { place_id: string; name: string; address: string | null; lat: number; lng: number }
      | null = null;

    if (forcePlaceId) {
      const details = await googlePlaceDetails(forcePlaceId);
      if (details.status === "OK" && details.result) {
        const loc = details.result.geometry?.location;
        candidate = {
          place_id: details.result.place_id,
          name: details.result.name,
          address: details.result.formatted_address ?? null,
          lat: loc?.lat ?? lat,
          lng: loc?.lng ?? lng,
        };
      }
    } else {
      const nearby = await googleNearby(lat, lng, 80);
      if (nearby.status === "OK" && nearby.results?.length) {
        const first = nearby.results[0];
        const loc = first.geometry?.location;
        candidate = {
          place_id: first.place_id,
          name: first.name,
          address: first.vicinity ?? first.formatted_address ?? null,
          lat: loc?.lat ?? lat,
          lng: loc?.lng ?? lng,
        };
      }
    }

    if (!candidate) return res.status(200).json({ status: "not_found" });

    // 2) Upsert (create if missing)
    const upsertBody = {
      google_place_id: candidate.place_id,
      name: candidate.name,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
    };

    const upsertResp: PostgrestSingleResponse<EstablishmentRow> = await supabaseAdmin
      .from("establishments")
      .upsert(upsertBody, { onConflict: "google_place_id" })
      .select("*")
      .single();

    if (upsertResp.error) {
      return res.status(500).json({ status: "error", error: upsertResp.error.message });
    }

    const row = upsertResp.data;

    // 3) Decide the status
    let status: ResolveStatus = "no_code";
    if (row?.restroom_available === false) status = "no_restroom";
    if (row?.code) status = "code";

    return res.status(200).json({
      status,
      establishment: {
        id: row.id,
        name: row.name,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        google_place_id: row.google_place_id,
      },
      code: row?.code ?? null,
      code_updated_at: row?.code_updated_at ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "resolve failed";
    return res.status(200).json({ status: "error", error: msg });
  }
}

// Force Node runtime so process.env is available
export const config = { api: { bodyParser: false } };
