// pages/api/auth/sync.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { serialize } from "cookie";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** One year; adjust to taste */
const defaultCookie: CookieOptions = {
  name: "sb-session",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  secure: true,              // required on HTTPS (Vercel prod)
  domain: ".dmndx.live",     // <-- this is what shares it across subdomains
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Wrap Next cookies with Supabase’s interface and force our domain
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name) {
        return req.cookies[name];
      },
      set(name, value, opts) {
        res.setHeader(
          "Set-Cookie",
          serialize(name, value, { ...defaultCookie, ...opts })
        );
      },
      remove(name, opts) {
        res.setHeader(
          "Set-Cookie",
          serialize(name, "", { ...defaultCookie, ...opts, maxAge: 0 })
        );
      },
    },
  });

  // Body can be { session } or { signOut: true }
  const { session, signOut } = (req.body ?? {}) as {
    session?: { access_token: string; refresh_token: string };
    signOut?: boolean;
  };

  if (signOut) {
    await supabase.auth.signOut();
    return res.status(200).json({ ok: true });
  }

  if (session?.access_token && session?.refresh_token) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Invalid payload" });
}
