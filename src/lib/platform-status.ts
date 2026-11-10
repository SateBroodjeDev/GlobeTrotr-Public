export function platformStatusFreshness(
  status: string,
  checkedAt: string | null,
  now = Date.now(),
  maxAgeMs = 90 * 60_000,
) {
  const timestamp = checkedAt ? Date.parse(checkedAt) : NaN;
  const stale =
    !Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp > maxAgeMs;
  return { stale, status: stale && !["outage", "degraded"].includes(status) ? "unknown" : status };
}

/** Old workers expose configuration only; that must never become green. */
export function flightMonitoringStatus(body: unknown, responseOk: boolean): string {
  const data = body as { status?: string; monitoring?: { schemaVersion?: number; status?: string; lookupStatus?: string; alertsStatus?: string } } | null;
  if (data?.status === "not_configured") return "unknown";
  if (!responseOk) return "degraded";
  const evidence = data?.monitoring;
  if (evidence?.schemaVersion !== 1) return "unknown";
  if (evidence.status === "degraded") return "degraded";
  if (evidence.status === "operational" && evidence.lookupStatus === "operational" &&
      ["operational", "not_enabled"].includes(evidence.alertsStatus ?? "")) return "operational";
  return "unknown";
}
