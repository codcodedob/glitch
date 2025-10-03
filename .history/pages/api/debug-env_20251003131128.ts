// pages/api/debug-env.ts
import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_MAPS_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const status: Record<string, boolean> = {};
  keys.forEach((k) => (status[k] = !!process.env[k]));
  res.status(200).json(status);
}
