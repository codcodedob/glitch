// lib/supabaseBrowser.ts
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Create one cached client for browser
let _client: SupabaseClient | null = null;

/**
 * getSupabaseBrowser()
 * Returns a singleton Supabase client (anon key).
 * Keeps TypeScript simple to prevent deep generic inference errors.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("⚠️ Missing Supabase env vars in browser");
    return null;
  }

  // Cast result to `any` to prevent “type instantiation is excessively deep” TS bug
  _client = createClient(url, key, {
    auth: { persistSession: true },
  }) as any;

  return _client;
}
