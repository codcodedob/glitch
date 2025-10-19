// pages/api/flag-code.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseService } from "@/lib/supabaseServer";


type Body = {
  establishment_id: string;
  code?: string | null;
  reason?: string | null; // e.g. "did not work"
};
type Resp = { ok: true } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data: userData, error: uerr } = await supabaseService.auth.getUser(token);
    if (uerr || !userData?.user) return res.status(401).json({ error: "Invalid token" });

    const userId = userData.user.id;

    const body = req.body as Body;
    if (!body?.establishment_id) return res.status(400).json({ error: "Missing establishment_id" });

    const { error } = await supabaseService.from("code_flags").insert({
      establishment_id: body.establishment_id,
      code: body.code ?? null,
      reason: body.reason ?? "did_not_work",
      flagged_by: userId,
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "flag-code failed" });
  }
}
