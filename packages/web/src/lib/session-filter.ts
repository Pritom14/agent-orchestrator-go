import type { DashboardSession } from "@/lib/types";

export function matchesFilter(session: DashboardSession, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [session.id, session.displayName, session.branch, session.issueTitle].some(
    (field) => field !== null && field !== undefined && field.toLowerCase().includes(q),
  );
}
