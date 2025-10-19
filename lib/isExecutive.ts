// lib/isExecutive.ts
import { supabaseService } from "./supabaseServer";

/**
 * Returns true if userId (or email) is primary_exec or in executives[] for any company.
 */
export async function isExecutive(userId?: string | null, email?: string | null) {
  if (!userId && !email) return { executive: false, companyName: null };

  // Query by userId OR email – adjust table/columns to match your schema.
  const { data, error } = await supabaseService
    .from("companies")
    .select("name, primary_exec, executives, emails")
    .limit(500);

  if (error || !data) return { executive: false, companyName: null };

  for (const row of data) {
    const execIds: string[] = Array.isArray(row.executives) ? row.executives : [];
    const emailList: string[] = Array.isArray(row.emails) ? row.emails : [];

    const byId =
      userId &&
      (row.primary_exec === userId || execIds.includes(userId));

    const byEmail = email && emailList.map((e) => e.toLowerCase()).includes(email.toLowerCase());

    if (byId || byEmail) {
      return { executive: true, companyName: row.name ?? null };
    }
  }
  return { executive: false, companyName: null };
}
