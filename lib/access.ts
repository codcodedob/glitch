// lib/access.ts
import type { MeResp } from "@/lib/fetchMe";

export function isGlitchMember(userData?: any) {
  if (!userData) return false;
  const type = (userData.subscriptionType || "").toUpperCase();
  const eligible = ["GLITCH", "DOBEONE", "DEMANDX", "ADOBSENSE"];
  return eligible.includes(type);
}

export function canViewCodes(me?: MeResp | null, firebaseUser?: any) {
  // executive or subscription types in Firebase are allowed
  if (me?.executive) return true;
  if (isGlitchMember(firebaseUser)) return true;
  return false;
}
