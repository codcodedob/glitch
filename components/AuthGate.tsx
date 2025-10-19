'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

type MeResp = {
  authenticated: boolean;
  email: string | null;
  user_id: string | null;
  executive: boolean;
  companyName: string | null;
};

type RenderArgs = {
  loading: boolean;
  authenticated: boolean;
  executive: boolean;
  email: string | null;
  userId: string | null;
  companyName: string | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

type Props = {
  children: (args: RenderArgs) => React.ReactNode;
};

/**
 * Fetches /api/auth/me once on mount, and re-fetches when the Supabase session changes.
 * No timers or polling — avoids the “infinite /api/auth/me” loop.
 */
export default function AuthGate({ children }: Props) {
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResp>({
    authenticated: false,
    email: null,
    user_id: null,
    executive: false,
    companyName: null,
  });

  const loadMe = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      const j = (await r.json()) as Partial<MeResp>;
      setMe({
        authenticated: !!j.authenticated,
        email: j.email ?? null,
        user_id: j.user_id ?? null,
        executive: !!j.executive,
        companyName: j.companyName ?? null,
      });
    } catch {
      setMe({
        authenticated: false,
        email: null,
        user_id: null,
        executive: false,
        companyName: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial
    void loadMe();

    // react to auth changes
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadMe();
    });
    return () => {
      sub?.subscription.unsubscribe();
    };
  }, [supabase, loadMe]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    await loadMe();
  }, [supabase, loadMe]);

  return (
    <>
      {children({
        loading,
        authenticated: me.authenticated,
        executive: me.executive,
        email: me.email,
        userId: me.user_id,
        companyName: me.companyName,
        signOut,
        refresh: loadMe,
      })}
    </>
  );
}
