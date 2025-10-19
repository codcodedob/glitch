// lib/stripePlans.ts
export const PLAN_BY_PRICE: Record<string, "GLITCH" | "DOBEONE" | "DEMANDX" | "ADOBSENSE"> = {
    [process.env.NEXT_PUBLIC_STRIPE_PRICE_GLITCH ?? ""]: "GLITCH",
    [process.env.NEXT_PUBLIC_STRIPE_PRICE_DOBEONE ?? ""]: "DOBEONE",
    [process.env.NEXT_PUBLIC_STRIPE_PRICE_DEMANDX ?? ""]: "DEMANDX",
    [process.env.NEXT_PUBLIC_STRIPE_PRICE_ADOBSENSE ?? ""]: "ADOBSENSE",
  };
  