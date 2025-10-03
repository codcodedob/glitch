import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const ADMIN_TOKEN = process.env.SUBMIT_ADMIN_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (ADMIN_TOKEN && req.headers["x-submit-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { establishment_id, code, staff_verified } = req.body || {};
  if (!establishment_id || !code || String(code).trim() === "") {
    return res.status(400).json({ error: "Missing establishment_id or code" });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anon) {
      const supabase = createClient(url, anon);
      const isStaff =
        !!ADMIN_TOKEN && req.headers["x-submit-token"] === ADMIN_TOKEN && !!staff_verified;

      const { error } = await supabase
        .from("bathroom_codes")
        .insert({ establishment_id, code: String(code).trim(), staff_verified: isStaff });
      if (error) throw error;

      return res.status(200).json({ ok: true });
    }

    // Dev fallback
    return res.status(200).json({ ok: true, dev: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Submit failed" });
  }
}
