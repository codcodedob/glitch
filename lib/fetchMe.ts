// lib/fetchMe.ts
import { getSupabaseBrowser } from "./supabaseBrowser";

export type MeResp = {
  authenticated: boolean;
  email: string | null;
  user_id: string | null;
  executive: boolean;
  companyName: string | null;
};

/**
 * Fetch /api/auth/me once. If a Supabase session exists, include the bearer
 * token; otherwise call without Authorization (endpoint should still return
 * { authenticated:false }).
 */
export async function fetchMeOnce(signal?: AbortSignal): Promise<MeResp> {
  const supabase = getSupabaseBrowser();
  let token: string | undefined;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      // ignore — will request without token
    }
  }

  const res = await fetch("/api/auth/me", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    // Fall back to anonymous shape on failure
    return {
      authenticated: false,
      email: null,
      user_id: null,
      executive: false,
      companyName: null,
    };
  }

  const j = (await res.json()) as Partial<MeResp>;
  return {
    authenticated: !!j.authenticated,
    email: j.email ?? null,
    user_id: j.user_id ?? null,
    executive: !!j.executive,
    companyName: j.companyName ?? null,
  };
}
