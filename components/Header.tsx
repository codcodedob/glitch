// components/Header.tsx
"use client";

import GlitchLogo from "@/components/GlitchLogo";
import SignInButton from "@/components/SignInButton"; // keep if you have it

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <GlitchLogo size={22} />
          <span className="font-semibold text-slate-100">glitch</span>
        </div>
        {typeof SignInButton === "function" ? <SignInButton /> : null}
      </div>
    </header>
  );
}
