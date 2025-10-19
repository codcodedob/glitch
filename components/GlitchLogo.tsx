// components/GlitchLogo.tsx
"use client";

type Props = { size?: number; className?: string };

export default function GlitchLogo({ size = 18, className = "" }: Props) {
  return (
    <span
      className={`relative inline-block select-none font-black tracking-tight text-fuchsia-400 ${className}`}
      style={{ fontSize: size }}
      aria-label="glitch logo"
    >
      <span className="relative z-10 animate-[glitch_2s_infinite]">G</span>
      <span className="pointer-events-none absolute left-0 top-0 z-0 animate-[glitchShift_2s_infinite] text-cyan-400 opacity-50">
        G
      </span>
      <style jsx>{`
        @keyframes glitch {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-0.5px, 0.5px); }
          20% { transform: translate(0.6px, -0.6px); }
          30% { transform: translate(-0.4px, 0.4px); }
          40% { transform: translate(0.3px, -0.3px); }
          50% { transform: translate(0, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes glitchShift {
          0% { transform: translate(0, 0); }
          10% { transform: translate(1px, -1px); }
          20% { transform: translate(-1px, 1px); }
          30% { transform: translate(1px, -1px); }
          40% { transform: translate(-1px, 1px); }
          50% { transform: translate(0, 0); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </span>
  );
}
