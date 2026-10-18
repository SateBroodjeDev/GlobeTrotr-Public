// Set this once to the announced beta-end timestamp. Keep that timestamp fixed
// afterwards: existing participants retain their badge, later signups do not.
export const BETA_SIGNUP_END_AT: string | null = null;

export function isBetaTesterAccount(
  createdAt: unknown,
  endedAt: string | null = BETA_SIGNUP_END_AT,
  now = Date.now(),
): boolean {
  if (typeof createdAt !== "string" || !createdAt.trim()) return false;
  const registered = Date.parse(createdAt);
  if (!Number.isFinite(registered) || registered > now) return false;
  if (endedAt === null) return true;
  const cutoff = Date.parse(endedAt);
  return Number.isFinite(cutoff) && registered < cutoff;
}
