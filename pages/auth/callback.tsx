// pages/auth/callback.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type State =
  | { kind: "working" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export default function AuthCallback() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setState({ kind: "error", message: "Supabase client not initialized." });
      return;
    }

    (async () => {
      try {
        // 1) Hash tokens (/#access_token=…&refresh_token=…)
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          const error = hash.get("error");
          const error_description = hash.get("error_description");

          if (error) throw new Error(error_description || error);

          if (access_token && refresh_token) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setErr) throw setErr;
            setState({ kind: "ok" });
            router.replace("/");
            return;
          }
        }

        // 2) PKCE code (?code=…)
        const code = typeof router.query.code === "string" ? router.query.code : null;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setState({ kind: "ok" });
          router.replace("/");
          return;
        }

        // 3) Email magic link (?type=magiclink&token_hash=…)
        const token_hash =
          typeof router.query.token_hash === "string" ? router.query.token_hash : null;
        const type = typeof router.query.type === "string" ? router.query.type : null;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any, // 'magiclink' | 'recovery' | etc
          });
          if (error) throw error;
          setState({ kind: "ok" });
          router.replace("/");
          return;
        }

        // Nothing to process -> bounce with a hint
        setState({ kind: "error", message: "Nothing to verify. Try signing in again." });
      } catch (e: any) {
        setState({ kind: "error", message: e?.message || "Could not complete sign-in." });
      }
    })();
  }, [router]);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-slate-950 text-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5">
        {state.kind === "working" && (
          <>
            <div className="text-lg font-semibold">Verifying sign-in…</div>
            <div className="mt-2 text-sm opacity-70">Please wait a moment.</div>
          </>
        )}
        {state.kind === "error" && (
          <>
            <div className="text-lg font-semibold">Sign-in link problem</div>
            <div className="mt-2 text-sm opacity-80">{state.message}</div>
            <a
              href="/auth"
              className="mt-4 inline-block rounded-xl border border-fuchsia-700 bg-fuchsia-800 px-3 py-2"
            >
              Try again
            </a>
          </>
        )}
      </div>
    </div>
  );
}
