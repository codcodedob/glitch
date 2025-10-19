// pages/auth/callback.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    async function run() {
      // 1) New-style email OTP: ?code=... (Supabase GoTrue v2)
      const code = typeof router.query.code === "string" ? router.query.code : null;
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // Optional: read ?error, ?error_code, ?error_description, show a nicer message
          console.error("exchangeCodeForSession error:", error);
          await router.replace("/?signin=failed");
          return;
        }
        await router.replace("/?signin=ok");
        return;
      }

      // 2) Old-style hash tokens (#access_token=...&refresh_token=...)
      // Next.js strips the hash by default from router.query, so read the real hash:
      const rawHash = window.location.hash || "";
      if (rawHash.includes("access_token") || rawHash.includes("refresh_token") || rawHash.includes("type=recovery")) {
        const params = new URLSearchParams(rawHash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error || !data.session) {
            console.error("setSession error:", error);
            await router.replace("/?signin=failed");
            return;
          }
          await router.replace("/?signin=ok");
          return;
        }
      }

      // 3) Nothing to exchange; check if already signed in
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await router.replace("/?signin=ok");
      } else {
        await router.replace("/?signin=failed");
      }
    }

    run();
    // only run once after mount with the initial router state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-100">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        Verifying sign-in…
      </div>
    </div>
  );
}
