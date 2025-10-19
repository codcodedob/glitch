// lib/getRedirect.ts
export function getEmailRedirectTo() {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "https://dmndx.live");
    return `${base}/auth/callback`;
  }
  