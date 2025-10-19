// pages/api/suggest-code.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAnonForAuth, supabaseService } from "@/lib/supabaseServer";

/** ---------- Types ---------- */
type Body =
  | {
      // code submission flow
      establishment_id?: string;
      place_id?: string;
      name: string;
      address: string | null;
      lat: number;
      lng: number;
      code: string; // required for this branch
    }
  | {
      // open-access (no code) flow
      establishment_id?: string;
      place_id?: string;
      name: string;
      address: string | null;
      lat: number;
      lng: number;
      open_access: true; // flag indicates open access
    };

type Resp =
  | { ok: true; staff_verified: boolean; company_name?: string | null }
  | { error: string };

/** ---------- Helpers ---------- */

/**
 * Pulls the Supabase user from the provided Bearer token.
 * Returns `null` if no/invalid token.
 */
async function getUserFromRequest(req: NextApiRequest) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return null;

  const { data, error } = await supabaseAnonForAuth.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Checks if user is an executive by looking in `companies` table:
 * primary_exec == userId OR userId is inside executives uuid[].
 * Returns `{ executive: boolean, companyName: string | null }`.
 */
async function getExecutiveStatus(userId: string): Promise<{ executive: boolean; companyName: string | null }> {
  // Try to find any company where this user is primary exec or in executives[]
  const { data, error } = await supabaseService
    .from("companies")
    .select("name, primary_exec, executives")
    .or(`primary_exec.eq.${userId},executives.cs.{${userId}}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { executive: false, companyName: null };
  }

  // If row exists, they’re executive
  return { executive: true, companyName: data.name ?? null };
}

/**
 * Ensure we have an establishment id. If only place_id is given, upsert establishment first.
 * Returns the UUID id of the establishment or null on failure.
 */
async function ensureEstablishmentId(body: Body): Promise<string | null> {
  const given = (body as any).establishment_id as string | undefined;
  if (given) return given;

  const placeId = (body as any).place_id as string | undefined;
  if (!placeId) return null;

  // Upsert on google_place_id
  const { data, error } = await supabaseService
    .from("establishments")
    .upsert(
      {
        google_place_id: placeId,
        name: body.name,
        address: body.address ?? body.name,
        lat: body.lat,
        lng: body.lng,
      },
      { onConflict: "google_place_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error("ensureEstablishmentId upsert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/** ---------- Handler ---------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // Exec status
  const exec = await getExecutiveStatus(user.id);
  const staffVerified = !!exec.executive; // boolean
  const source = staffVerified ? "executive" : "echelon";

  // Parse body
  const body = req.body as Body;
  if (
    !body ||
    !body.name ||
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    (("open_access" in body) ? false : !("code" in body))
  ) {
    return res.status(400).json({ error: "Bad request body" });
  }

  // Ensure establishment
  let establishment_id = await ensureEstablishmentId(body);
  if (!establishment_id) {
    return res.status(400).json({ error: "Missing establishment_id or place_id" });
  }

  try {
    // If open access, mark available; do not insert code
    if ("open_access" in body && body.open_access === true) {
      const { error } = await supabaseService
        .from("establishments")
        .update({ restroom_available: true })
        .eq("id", establishment_id);
      if (error) throw error;

      return res.status(200).json({ ok: true, staff_verified: staffVerified, company_name: exec.companyName ?? null });
    }

    // Otherwise, require code
    const code = (body as any).code as string | undefined;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Missing code" });
    }

    // Insert into bathroom_codes
    const { error: insErr } = await supabaseService.from("bathroom_codes").insert({
      establishment_id,
      code: code.trim(),
      staff_verified: staffVerified,
      submitted_by: user.id,
      source,
    });

    if (insErr) throw insErr;

    return res.status(200).json({
      ok: true,
      staff_verified: staffVerified,
      company_name: exec.companyName ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "suggest-code failed";
    console.error("suggest-code error:", msg);
    return res.status(500).json({ error: msg });
  }
}
