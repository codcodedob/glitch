// lib/subscription.ts

// Example shape you shared (Firebase doc)
export type FirebaseUserShape = {
    status?: "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE" | string;
    stripeCustomerId?: string;
    subEndIso?: string | null;
    subscriptionType?: string | null;  // e.g. "FREETRIAL", "GLITCH", "DOBEONE", "DEMANDX", "ADOBSENSE"
    trialUsed?: boolean;
    updatedAt?: string;
  };
  
  const ALLOWED_PLANS = new Set(["GLITCH", "DOBEONE", "DEMANDX", "ADOBSENSE"]);
  
  export function hasActiveSubscription(u?: FirebaseUserShape | null) {
    if (!u) return false;
  
    // status ACTIVE + end date in the future (if provided)
    const statusOk = u.status === "ACTIVE";
    let endOk = true;
    if (u.subEndIso) {
      const end = Date.parse(u.subEndIso);
      if (!Number.isNaN(end)) endOk = end > Date.now();
    }
  
    const planOk = u.subscriptionType ? ALLOWED_PLANS.has(u.subscriptionType.toUpperCase()) : false;
  
    return statusOk && endOk && planOk;
  }
  
  /**
   * One-off unlocks (e.g., $1 code) are site-specific; you might keep a map like:
   * { [establishmentId]: true } for the current user session or in your DB.
   * This helper allows you to combine both checks.
   */
  export function canViewCodes(opts: {
    userProfile?: FirebaseUserShape | null;
    oneOffUnlocked?: boolean;
  }) {
    return hasActiveSubscription(opts.userProfile) || !!opts.oneOffUnlocked;
  }
  