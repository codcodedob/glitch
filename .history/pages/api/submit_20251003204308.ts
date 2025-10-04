import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const ADMIN_TOKEN = process.env.SUBMIT_ADMIN_TOKEN;

type Body =
  | {
      // add/update code
      establishment_id?: string;
      place_id?: string;
      name: string;
      address: string | null;
      lat: number;
      lng: number;
      code: string;
      open_access?: false;
      staff_verified?: boolean;
    }
  | {
      // open access (no code)
      establishment_id?: string;
      place_id?: string;
      name: string;
      address: string | null;
      lat: number;
      lng: number;
      open_access: true;
      staff_verified?: boolean;
    };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (ADMIN_TOKEN && req.headers["x-submit-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as Body;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(500).json({ error: "Server misconfigured" });

  const supabase = createClient(url, anon);

  try {
    // Ensure we have an establishment id. If only place_id is given, upsert establishment first.
    let establishment_id = body.establishment_id as string | undefined;

    if (!establishment_id && body.place_id) {
      const { data, error } = await supabase
        .from("establishments")
        .upsert(
          {
            google_place_id: body.place_id,
            name: body.name,
            address: body.address ?? body.name,
            lat: body.lat,
            lng: body.lng,
          },
          { onConflict: "google_place_id" }
        )
        .select("id")
        .single();
      if (error) throw error;
      establishment_id = data?.id as string;
    }

    if (!establishment_id) {
      return res.status(400).json({ error: "Missing establishment_id or place_id" });
    }

    // If open access, mark restroom_available = true, and do not insert a code
    if ("open_access" in body && body.open_access === true) {
      const { error } = await supabase
        .from("establishments")
        .update({ restroom_available: true })
        .eq("id", establishment_id);
      if (error) throw error;
      return res.status(200).json({ ok: true, open_access: true });
    }

    // Otherwise, save the code
    if (!("code" in body) || !String(body.code).trim()) {
      return res.status(400).json({ error: "Missing code" });
    }

    const isStaff = !!ADMIN_TOKEN && req.headers["x-submit-token"] === ADMIN_TOKEN && !!body.staff_verified;
    const { error } = await supabase
      .from("bathroom_codes")
      .insert({ establishment_id, code: String(body.code).trim(), staff_verified: isStaff });

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Submit failed";
    return res.status(500).json({ error: msg });
  }
}
