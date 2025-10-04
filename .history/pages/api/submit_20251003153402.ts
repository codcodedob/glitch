// pages/api/submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ADMIN_TOKEN = process.env.SUBMIT_ADMIN_TOKEN ?? "";

type SubmitBody = {
  establishment_id?: string;
  code?: string;
  staff_verified?: boolean;
};

type SubmitResponse =
  | { ok: true; dev?: true }
  | { error: string };

function getHeader(req: NextApiRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmitResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional admin token gate (when set)
  const providedToken = getHeader(req, "x-submit-token");
  if (ADMIN_TOKEN && providedToken !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body: SubmitBody = (req.body ?? {}) as SubmitBody;
  const establishment_id = body.establishment_id?.trim();
  const code = body.code?.trim();
  const staff_verified = !!body.staff_verified;

  if (!establishment_id || !code) {
    return res
      .status(400)
      .json({ error: "Missing establishment_id or code" });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anon) {
      const supabase: SupabaseClient = createClient(url, anon);

      // Only honor staff_verified when a valid ADMIN_TOKEN is configured and provided
      const isStaff =
        Boolean(ADMIN_TOKEN) && providedToken === ADMIN_TOKEN && staff_verified;

      const { error } = await supabase
        .from("bathroom_codes")
        .insert({
          establishment_id,
          code,
          staff_verified: isStaff,
        });

      if (error) {
        // surface supabase error message cleanly
        return res.status(500).json({ error: error.message || "Insert failed" });
      }

      return res.status(200).json({ ok: true });
    }

    // Dev fallback (no Supabase env set on server)
    return res.status(200).json({ ok: true, dev: true });
  } catch (e: unknown) {
    const err = e as Error;
    return res
      .status(500)
      .json({ error: err.message || "Submit failed" });
  }
}
