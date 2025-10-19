// lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

export function getServerSupabase(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: () => {},     // we only *read* in most APIs
        remove: () => {},
      },
    }
  );
}
