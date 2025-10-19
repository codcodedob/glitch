// components/AutoZIndexPortal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type RenderArg = {
  zIndex: number;
  lockTop: () => void;
  locked: boolean;
};

type Props = {
  open: boolean;
  children: (args: RenderArg) => React.ReactNode;
};

export default function AutoZIndexPortal({ open, children }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zIndex, setZIndex] = useState(10000);
  const [locked, setLocked] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Create a host div for the portal when mounted
  useEffect(() => {
    if (!mounted) return;
    const el = document.createElement("div");
    el.setAttribute("data-azp", "1");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.zIndex = String(zIndex);
    document.body.appendChild(el);
    hostRef.current = el;

    return () => {
      el.remove();
      hostRef.current = null;
    };
  }, [mounted]);

  // Auto-raise zIndex until locked
  useEffect(() => {
    if (!mounted || !hostRef.current) return;
    if (!open) return;

    if (!locked) {
      const tick = setInterval(() => {
        setZIndex((z) => Math.min(z + 100, 20000));
      }, 300);
      return () => clearInterval(tick);
    }
  }, [mounted, open, locked]);

  // Apply live z-index
  useEffect(() => {
    if (hostRef.current) hostRef.current.style.zIndex = String(zIndex);
  }, [zIndex]);

  const renderArg = useMemo<RenderArg>(
    () => ({
      zIndex,
      lockTop: () => setLocked(true),
      locked,
    }),
    [zIndex, locked]
  );

  if (!open || !mounted || !hostRef.current) return null;
  return createPortal(children(renderArg), hostRef.current);
}
