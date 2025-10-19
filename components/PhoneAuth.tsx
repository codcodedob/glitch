// components/PhoneAuth.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function PhoneAuth() {
  const supabase = getSupabaseBrowser();
  const [step, setStep] = useState<"enter-phone" | "enter-code">("enter-phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendCode() {
    setMsg(null);
    if (!supabase) return setMsg("Auth not initialized.");
    if (!/^\+\d{6,15}$/.test(phone)) return setMsg("Use E.164 format, e.g. +15551234567");

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: "sms" },
      });
      if (error) throw error;
      setStep("enter-code");
      setMsg("Code sent. Check your SMS.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setMsg(null);
    if (!supabase) return setMsg("Auth not initialized.");
    if (!code.trim()) return setMsg("Enter the 6-digit code.");

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code.trim(),
        type: "sms",
      });
      if (error) throw error;
      if (data?.session) {
        setMsg("Signed in ✔");
        // optional: window.location.replace("/") or lift state up
      } else {
        setMsg("Verification failed.");
      }
    } catch (e: any) {
      setMsg(e?.message || "Verify failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100 shadow-xl">
      <h3 className="text-lg font-semibold">Sign in with phone</h3>

      {step === "enter-phone" && (
        <>
          <label className="mt-3 block text-xs opacity-70">Phone (E.164)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2"
            placeholder="+15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            onClick={sendCode}
            disabled={loading}
            className="mt-3 w-full rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </>
      )}

      {step === "enter-code" && (
        <>
          <div className="mt-2 text-xs opacity-70">We sent a code to {phone}</div>
          <label className="mt-3 block text-xs opacity-70">Enter code</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            onClick={verifyCode}
            disabled={loading}
            className="mt-3 w-full rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            onClick={() => setStep("enter-phone")}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Change phone
          </button>
        </>
      )}

      {msg && <div className="mt-3 text-xs opacity-80">{msg}</div>}
    </div>
  );
}
