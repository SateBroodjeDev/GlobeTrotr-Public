export type AgencyLoginState = "ready" | "pending" | "dns_pending" | "unconfigured" | "error" | "unknown";
export type AgencyLoginSnapshot = { checked_hosts?: string[]; checked_at?: string | null; error_code?: string | null };

export function agencyLoginState(host: string, verified: boolean, snapshot: AgencyLoginSnapshot | null,
  now = Date.now()): AgencyLoginState {
  if (!verified) return "dns_pending";
  if (!snapshot) return "unconfigured";
  const age = now - Date.parse(snapshot.checked_at ?? "");
  if (!Number.isFinite(age) || age < -30000 || age > 180000) return "unknown";
  if (snapshot.error_code) return "error";
  return snapshot.checked_hosts?.includes(host) ? "ready" : "pending";
}
