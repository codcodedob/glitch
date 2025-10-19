// components/GlobeWidget.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  className?: string;
};

export default function GlobeWidget({ className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // SSR/No-DOM guard
    if (typeof window === "undefined") return;

    const DPR = window.devicePixelRatio || 1;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const el = canvasRef.current;
      if (!el) return; // guard in case unmounted mid-resize

      const w = el.clientWidth || 300;
      const h = el.clientHeight || 150;

      // Make sure the backing store matches CSS size * DPR
      el.width = Math.max(1, Math.round(w * DPR));
      el.height = Math.max(1, Math.round(h * DPR));
    }

    let raf = 0;
    let t = 0;

    function draw() {
      const el = canvasRef.current;
      if (!el) return; // unmounted guard
      if (!ctx) return;

      ctx.clearRect(0, 0, el.width, el.height);

      // Simple animated ring + dots (lightweight placeholder)
      const cx = el.width / 2;
      const cy = el.height / 2;
      const r = Math.min(cx, cy) * 0.9;

      // Ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = Math.max(1, DPR);
      ctx.stroke();

      // Dots
      const dots = 40;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * Math.PI * 2 + t * 0.01;
        const x = cx + r * Math.cos(a) * Math.cos(t * 0.01);
        const y = cy + r * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 2 * DPR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.8)"; // indigo-ish
        ctx.fill();
      }

      t += 1;
      raf = window.requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
