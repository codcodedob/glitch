import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { id, code, staffVerified } = req.body as {
    id: string;
    code: string;
    staffVerified?: boolean;
  };

  if (!id || !code)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const { error } = await supabase.from("bathroom_codes").insert([
      {
        establishment_id: id,
        code,
        staff_verified: !!staffVerified,
      },
    ]);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return res.status(500).json({ error: msg });
  }
}
