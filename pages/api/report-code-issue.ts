// pages/api/report-code-issue.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAnonForAuth, supabaseService } from "@/lib/supabaseServer";

type Body = {
  establishment_id?: string;
  code_id?: string | null;
  reason?: string | null; // free text (optional)
  issue?: "didnt_work" | "wrong_place" | "other" | null; // optional, normalized category
};

type Resp = { ok: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Require a Bearer token (user must be signed in)
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: udata, error: uerr } = await supabaseAnonForAuth.auth.getUser(token);
  if (uerr || !udata?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = udata.user.id;

  // Parse and sanitize body (no optional-chaining calls to keep TS happy)
  const body = (req.body ?? {}) as Body;

  const establishment_id =
    typeof body.establishment_id === "string" ? body.establishment_id.trim() : "";
  const code_id = body.code_id ?? null;

  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  const issue: "didnt_work" | "wrong_place" | "other" | null =
    body.issue === "didnt_work" || body.issue === "wrong_place" || body.issue === "other"
      ? body.issue
      : null;

  if (!establishment_id && !code_id) {
    return res.status(400).json({ error: "Provide establishment_id or code_id" });
  }

  // Insert report (adjust table/columns if your schema uses different names)
  const { error: insErr } = await supabaseService
    .from("bathroom_code_flags") // or your table name
    .insert({
      establishment_id: establishment_id || null,
      code_id,           // may be null
      reason,            // optional text
      category: issue,   // ensure this column exists if you want it
      flagged_by: userId,
    });

  if (insErr) {
    console.error("report-code-issue insert error:", insErr.message);
    return res.status(500).json({ error: "Failed to submit report" });
  }

  return res.status(200).json({ ok: true });
}
