// pages/api/resolve-building.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type EstablishmentRow = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id?: string | null;
  restroom_available?: boolean | null;
  code?: string | null;
  code_updated_at?: string | null;
};

export type ResolveRes = {
  status: "code" | "no_code" | "no_restroom" | "not_found" | "error";
  establishment?: EstablishmentRow;
  code?: string | null;
  code_updated_at?: string | null;
  error?: string;
};

type GoogleNearbyResponse = {
  results: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
  }>;
  status: string;
};

type GoogleDetailsResponse = {
  result?: {
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
  };
  status: string;
};

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

async function googleNearby(lat: number, lng: number): Promise<GoogleNearbyResponse> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "50");
  url.searchParams.set("type", "establishment");
  url.searchParams.set("key", GOOGLE_KEY);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Google nearby ${r.status}`);
  return (await r.json()) as GoogleNearbyResponse;
}

async function googlePlaceDetails(placeId: string): Promise<GoogleDetailsResponse> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", GOOGLE_KEY);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Google details ${r.status}`);
  return (await r.json()) as GoogleDetailsResponse;
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
  const forcePlaceId =
    typeof req.query.place_id === "string" ? req.query.place_id : null;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res
      .status(400)
      .json({ status: "error", error: "Invalid lat/lng" });
  }
  if (!GOOGLE_KEY) {
    return res
      .status(500)
      .json({ status: "error", error: "Missing GOOGLE_MAPS_API_KEY" });
  }

  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    let first: GoogleNearbyResponse["results"][number] | GoogleDetailsResponse["result"] | undefined;

    if (forcePlaceId) {
      const details = await googlePlaceDetails(forcePlaceId);
      first = details?.result;
    } else {
      const nearby = await googleNearby(lat, lng);
      first = nearby?.results?.[0];
    }

    if (!first) {
      return res.status(200).json({ status: "not_found" });
    }

    const placeId = first.place_id;
    const name = first.name;
    const loc = first.geometry?.location;
    const address = first.vicinity || first.formatted_address || name;

    const { data: est, error: upErr } = await supabase
      .from("establishments")
      .upsert(
        {
          google_place_id: placeId,
          name,
          address,
          lat: loc?.lat ?? lat,
          lng: loc?.lng ?? lng,
        },
        { onConflict: "google_place_id" }
      )
      .select("*")
      .single<EstablishmentRow>();

    if (upErr) throw new Error(upErr.message);

    const { data: row, error: vErr } = await supabase
      .from("establishments_view")
      .select("*")
      .eq("id", est.id)
      .single<EstablishmentRow>();

    if (vErr) throw new Error(vErr.message);

    let status: ResolveRes["status"] = "no_code";
    if (row.restroom_available === false) status = "no_restroom";
    if (row.code) status = "code";

    return res.status(200).json({
      status,
      establishment: {
        id: row.id,
        name: row.name,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        google_place_id: placeId,
      },
      code: row.code,
      code_updated_at: row.code_updated_at,
    });
  } catch (e: unknown) {
    const err = e as Error;
    return res
      .status(200)
      .json({ status: "error", error: err.message || "resolve failed" });
  }
}
