// components/AuthSync.tsx
"use client";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthSync() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Mirror the client session into a cookie that works on all subdomains
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          session
            ? {
                session: {
                  access_token: session.access_token!,
                  refresh_token: session.refresh_token!,
                },
              }
            : { signOut: true }
        ),
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
