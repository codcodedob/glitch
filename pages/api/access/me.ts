// pages/api/access/me.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  // TODO: look up by supabase auth token -> user id -> your DB subscription fields
  return res.status(200).json({ access: "NONE" as "NONE" | "PASS" | "SUB" });
}
