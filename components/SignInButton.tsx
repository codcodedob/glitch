// components/SignInButton.tsx
"use client";
import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";
import AuthPanel from "./AuthPanel";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignInButton() {
  const supabase = getSupabaseBrowser();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Sign in");

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user || null;
      if (!mounted) return;

      if (!user) {
        setLabel("Sign in");
      } else {
        const phone = user.phone ?? "";
        const email = user.email ?? "";
        const idLabel = phone || email || "Account";
        setLabel(idLabel);
      }
    }

    refresh();
    const { data: sub } = supabase?.auth.onAuthStateChange(() => refresh()) ?? { data: null };
    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
          type="button"
        >
          {label}
        </button>
        {label !== "Sign in" && (
          <button
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        )}
      </div>

      <AuthModal open={open} onClose={() => setOpen(false)} title="Sign in">
        <AuthPanel />
      </AuthModal>
    </>
  );
}
