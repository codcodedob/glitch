import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id, code, staffVerified } = req.body;

  const { data, error } = await supabase
    .from("establishments")
    .update({
      code,
      code_updated_at: new Date().toISOString(),
      staff_verified: staffVerified ?? false,
    })
    .eq("id", id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, updated: data });
}
