"use client";
import { useEffect, useState } from "react";

type Me = {
  authenticated: boolean;
  executive?: boolean;
  user?: { id: string; email?: string | null } | null;
  companyName?: string | null;
};

export default function useAuth() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: { "cache-control": "no-store" } });
        const data = (await res.json()) as Me;
        if (!ignore) setMe(data);
      } catch {
        if (!ignore) setMe({ authenticated: false });
      }
    };
    run();
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      ignore = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return me;
}
