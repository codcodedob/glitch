import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAnonForAuth, supabaseService } from "@/lib/supabaseServer";
import { isExecutive } from "@/lib/isExecutive";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // auth
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabaseAnonForAuth.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = data.user.id;

    // body
    const body = req.body || {};
    const establishment_id: string | undefined = body.establishment_id;
    const place_id: string | undefined = body.place_id;
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const name = String(body.name ?? "");
    const address = String(body.address ?? "");
    const open_access = Boolean(body.open_access);
    const code = typeof body.code === "string" ? body.code.trim() : "";

    // ensure establishment exists (by id or upsert via place_id + coords)
    let finalEstId = establishment_id;

    if (!finalEstId) {
      if (!place_id && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        return res.status(400).json({ error: "Missing establishment or coordinates" });
      }

      // try find by google_place_id first
      if (place_id) {
        const { data: found } = await supabaseService
          .from("establishments")
          .select("id")
          .eq("google_place_id", place_id)
          .maybeSingle();

        if (found?.id) finalEstId = found.id;
      }

      if (!finalEstId) {
        // upsert a shell establishment
        const { data: up, error: upErr } = await supabaseService
          .from("establishments")
          .upsert(
            {
              google_place_id: place_id ?? null,
              name,
              address,
              lat,
              lng,
            },
            place_id ? { onConflict: "google_place_id" } : undefined
          )
          .select("id")
          .maybeSingle();

        if (upErr) throw upErr;
        finalEstId = up?.id;
      }
    }

    if (!finalEstId) return res.status(500).json({ error: "Could not resolve establishment" });

    // source label
    const { executive } = await isExecutive(userId);
    const source = executive ? "executive" : "echelon";

    // open access path: mark establishment; no bathroom_codes row
    if (open_access) {
      const { error: uErr } = await supabaseService
        .from("establishments")
        .update({ restroom_available: true })
        .eq("id", finalEstId);

      if (uErr) throw uErr;
      return res.status(200).json({ ok: true, open_access: true, source });
    }

    // code path: must have non-empty code
    if (!code) return res.status(400).json({ error: "Missing code" });

    const { error: insErr } = await supabaseService.from("bathroom_codes").insert({
      establishment_id: finalEstId,
      code,
      submitted_by: userId,
      source,
    });

    if (insErr) throw insErr;

    // optionally flip restroom_available to true if code exists
    await supabaseService.from("establishments").update({ restroom_available: true }).eq("id", finalEstId);

    return res.status(200).json({ ok: true, source });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
