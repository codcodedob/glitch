// pages/api/auth/me.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseService, supabaseAnonForAuth } from "@/lib/supabaseServer";

/**
 * Shape we return to the client
 */
type MeResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: {
        id: string;
        email: string | null;
        phone: string | null;
        app_metadata?: Record<string, any>;
        user_metadata?: Record<string, any>;
      };
      profile?: Record<string, any> | null;
      roles?: string[] | null;
      executive: boolean;
      companyName: string | null;
      plan?: string | null;
    };

/**
 * Try to read a JWT from the Authorization header or a cookie set by /api/auth/sync.
 */
function getJwtFromRequest(req: NextApiRequest): string | undefined {
  // 1) Authorization: Bearer <token>
  const bearer = req.headers.authorization;
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);

  // 2) Cookie (whatever your /api/auth/sync sets—adjust names if you changed them)
  const cookie = req.headers.cookie || "";
  // Common names we might have set during sync; check both
  const m1 = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (m1?.[1]) return decodeURIComponent(m1[1]);

  const m2 = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  if (m2?.[1]) return decodeURIComponent(m2[1]);

  return undefined;
}

/**
 * GET /api/auth/me
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MeResponse | { error: string }>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Prefer header/cookie token. If none, we’ll still try anon client (but usually that won’t have a session).
  const token = getJwtFromRequest(req);

  try {
    // Verify the user using the **server** client.
    // If you want to tolerate missing token in dev, keep it soft-failing to {authenticated:false}.
    if (!token) {
      return res.status(200).json({ authenticated: false });
    }

    // Validate the JWT server-side
    const { data: verified, error: verifyErr } = await supabaseService.auth.getUser(token);
    if (verifyErr || !verified?.user) {
      return res.status(200).json({ authenticated: false });
    }

    const sbUser = verified.user;

    // Optionally load a profile row (if you have a "profiles" table keyed by user.id)
    let profile: Record<string, any> | null = null;
    try {
      const { data: profRows, error: profErr } = await supabaseService
        .from("profiles")
        .select("*")
        .eq("id", sbUser.id)
        .limit(1);

      if (!profErr && Array.isArray(profRows) && profRows.length > 0) {
        profile = profRows[0];
      }
    } catch {
      // Table might not exist yet — that's fine
    }

    // Executive check: either primary_exec = user.id OR executives uuid[] contains user.id
    let executive = false;
    let companyName: string | null = null;

    try {
      // Check primary_exec
      const { data: primaryRows, error: pErr } = await supabaseService
        .from("companies")
        .select("id,name")
        .eq("primary_exec", sbUser.id)
        .limit(1);

      if (!pErr && Array.isArray(primaryRows) && primaryRows.length > 0) {
        executive = true;
        companyName = primaryRows[0].name ?? null;
      } else {
        // Check executives[] contains user.id
        const { data: execRows } = await supabaseService
          .from("companies")
          .select("id,name,executives")
          .contains("executives", [sbUser.id])
          .limit(1);

        if (Array.isArray(execRows) && execRows.length > 0) {
          executive = true;
          companyName = execRows[0].name ?? null;
        }
      }
    } catch {
      // companies table may not exist yet — treat as non-executive
    }

    // Optional roles (from user_metadata.roles if present)
    const roles: string[] | null =
      Array.isArray((sbUser.user_metadata as any)?.roles)
        ? ((sbUser.user_metadata as any).roles as string[])
        : null;

    // Optional plan (choose one strategy below)
    // Strategy A: read from profiles.plan
    let plan: string | null = null;
    if (profile && typeof profile.plan === "string") {
      plan = profile.plan;
    }

    // Strategy B (optional): read from a "user_plans" or "subscriptions" table keyed by user_id
    // try {
    //   const { data: plans } = await supabaseService
    //     .from("user_plans")
    //     .select("plan")
    //     .eq("user_id", sbUser.id)
    //     .order("created_at", { ascending: false })
    //     .limit(1);
    //   if (Array.isArray(plans) && plans.length) {
    //     plan = plans[0].plan ?? plan;
    //   }
    // } catch {}

    return res.status(200).json({
      authenticated: true,
      user: {
        id: sbUser.id,
        email: sbUser.email ?? null,
        phone: sbUser.phone ?? null,
        app_metadata: sbUser.app_metadata,
        user_metadata: sbUser.user_metadata,
      },
      profile: profile ?? undefined,
      roles: roles ?? undefined,
      executive,
      companyName,
      plan: plan ?? undefined,
    });
  } catch (e) {
    console.error("/api/auth/me error", e);
    return res.status(200).json({ authenticated: false });
  }
}
