// components/AuthPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const EMAIL_REDIRECT_FALLBACK = "/auth/callback";

async function syncSession() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const payload = data?.session
    ? {
        session: {
          access_token: data.session.access_token!,
          refresh_token: data.session.refresh_token!,
        },
      }
    : { signOut: true };

  await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

type Mode = "email" | "phone";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); // +15551234567
  const [otp, setOtp] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    // initial session check
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data?.session);
    });

    // subscribe to auth changes
    const result = supabase.auth.onAuthStateChange(async () => {
      await syncSession();
      const { data } = await supabase.auth.getSession();
      setAuthed(!!data?.session);
    });

    // SAFELY clean up (guard for undefined)
    const subscription = result?.data?.subscription;
    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, []);

  async function handleEmail() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return alert("Auth not ready");
    if (!email) return;

    setBusy(true);
    setMsg(null);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${EMAIL_REDIRECT_FALLBACK}`
          : process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}${EMAIL_REDIRECT_FALLBACK}`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setMsg("Magic link sent. Check your inbox.");
    } catch (e: any) {
      setMsg(e?.message || "Email sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestSms() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return alert("Auth not ready");
    if (!phone) return;

    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: "sms" },
      });
      if (error) throw error;
      setNeedsCode(true);
      setMsg("SMS sent. Enter the 6-digit code.");
    } catch (e: any) {
      setMsg(e?.message || "Phone sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifySms() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return alert("Auth not ready");
    if (!phone || !otp) return;

    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (error) throw error;

      await syncSession();
      setMsg("Signed in!");
      setAuthed(true);
      setNeedsCode(false);
      setOtp("");
    } catch (e: any) {
      setMsg(e?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (authed) return null;

  // upper-third centered panel
  return (
    <div className="pointer-events-none fixed inset-0 z-[10400] flex">
      <div className="pointer-events-auto m-auto mt-[10vh] w-full max-w-md px-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 text-slate-100 shadow-2xl">
          <div className="mb-3 text-center">
            <div className="text-sm opacity-70">Sign in to Glitch</div>
            <div className="text-lg font-semibold">Access codes & contributions</div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                mode === "email"
                  ? "border-emerald-700 bg-emerald-900/40"
                  : "border-slate-700 bg-slate-800 hover:bg-slate-700/70"
              }`}
              onClick={() => {
                setMode("email");
                setNeedsCode(false);
                setMsg(null);
              }}
            >
              Email
            </button>
            <button
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                mode === "phone"
                  ? "border-emerald-700 bg-emerald-900/40"
                  : "border-slate-700 bg-slate-800 hover:bg-slate-700/70"
              }`}
              onClick={() => {
                setMode("phone");
                setNeedsCode(false);
                setMsg(null);
              }}
            >
              Phone
            </button>
          </div>

          {mode === "email" ? (
            <div>
              <label className="mb-1 block text-xs opacity-70">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2"
                placeholder="you@example.com"
                autoComplete="email"
              />
              <button
                onClick={handleEmail}
                disabled={busy || !email}
                className="mt-3 w-full rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </div>
          ) : (
            <div>
              {!needsCode ? (
                <>
                  <label className="mb-1 block text-xs opacity-70">Phone (E.164)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2"
                    placeholder="+15551234567"
                    autoComplete="tel"
                  />
                  <button
                    onClick={requestSms}
                    disabled={busy || !phone}
                    className="mt-3 w-full rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send code by SMS"}
                  </button>
                </>
              ) : (
                <>
                  <label className="mb-1 block text-xs opacity-70">Enter 6-digit code</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 tracking-widest"
                    placeholder="••••••"
                  />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setNeedsCode(false)}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2"
                    >
                      Back
                    </button>
                    <button
                      onClick={verifySms}
                      disabled={busy || !otp}
                      className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium disabled:opacity-50"
                    >
                      {busy ? "Verifying…" : "Verify"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {msg && <div className="mt-3 text-center text-xs opacity-80">{msg}</div>}

          <div className="mt-4 text-center text-[11px] opacity-60">
            By continuing you agree to our Terms and acknowledge our Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
