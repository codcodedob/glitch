// pages/api/submit.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { establishment_id, code } = req.body || {};
  if (!establishment_id || !code) {
    return res.status(400).json({ error: "Missing establishment_id or code" });
  }

  // TODO: Insert into DB (Supabase, etc). Example:
  // const { data, error } = await supabase.from("bathroom_codes").insert({ establishment_id, code }).select("*").single();
  // if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
