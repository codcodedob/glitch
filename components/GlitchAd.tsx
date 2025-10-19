// components/GlitchAd.tsx
"use client";

type Shot = {
  img: string;           // put your /public images here
  caption?: string;      // optional small corner text
  hud?: string;          // tiny overlay tag like "EXECUTIVE VERIFIED"
  duration?: number;     // ms, default 2500
};

const shots: Shot[] = [
  { img: "/ad/1-cold-open.jpg", caption: "Not every door is a dead end.", duration: 1800 },
  { img: "/ad/2-scan.jpg", hud: "Locating…", duration: 2200 },
  { img: "/ad/3-team.jpg", caption: "Quiet. Precise.", duration: 2200 },
  { img: "/ad/4-keypad.jpg", hud: "Signal: faint", duration: 2200 },
  { img: "/ad/5-verify.jpg", hud: "EXECUTIVE VERIFIED", duration: 2200 },
  { img: "/ad/6-open.jpg", caption: "Customer access", duration: 1800 },
  { img: "/ad/7-field.jpg", hud: "Echelon suggestion → queued", duration: 2200 },
  { img: "/ad/8-cause.jpg", caption: "Because relief isn’t a luxury.", duration: 2200 },
];

import { useEffect, useRef, useState } from "react";

export default function GlitchAd({ onEnd }: { onEnd?: () => void }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const d = shots[idx]?.duration ?? 2200;
    timer.current = window.setTimeout(() => {
      const next = idx + 1;
      if (next < shots.length) setIdx(next);
      else onEnd?.();
    }, d);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [idx, onEnd]);

  const s = shots[idx];
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
      {s ? (
        <>
          <img
            src={s.img}
            alt=""
            className="h-full w-full object-cover opacity-95"
          />
          {s.hud && (
            <div className="absolute left-3 top-3 rounded-md border border-cyan-700 bg-cyan-900/40 px-2 py-1 text-[11px] text-cyan-100">
              {s.hud}
            </div>
          )}
          {s.caption && (
            <div className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-sm text-slate-100 backdrop-blur">
              {s.caption}
            </div>
          )}
          {/* Glitch scanline */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,.04)_50%,transparent_100%)] mix-blend-overlay" />
        </>
      ) : (
        <div className="grid h-full place-items-center text-slate-300">Be a part of the Glitch program.</div>
      )}
      <div className="absolute right-3 bottom-3 flex items-center gap-2">
        <a
          href="/pricing"
          className="rounded-lg border border-emerald-700 bg-emerald-800/80 px-3 py-1.5 text-sm text-emerald-50 hover:bg-emerald-700"
        >
          Join Glitch
        </a>
      </div>
    </div>
  );
}
