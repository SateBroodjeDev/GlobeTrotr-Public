const freshnessMs = 90 * 60_000;
const providers = new Set(["aerodatabox", "skylink"]);
const recent = (at, now) => Number.isFinite(at) && at <= now && now - at <= freshnessMs;

// In-memory observations only: no flight numbers, passengers, payloads or keys.
// Reading health never refreshes evidence or makes a provider request.
export function createFlightHealth() {
  const lookups = new Map();
  let balanceFailureAt = null;
  let balanceSucceededAt = null;
  return {
    lookup(provider, successful, now = Date.now()) {
      if (providers.has(provider)) lookups.set(provider, { successful: successful === true, at: now });
    },
    lookupFailure(provider, error, now = Date.now()) {
      // One missing flight or invalid stored date is not a provider outage.
      if (["FLIGHT_NOT_FOUND", "FLIGHT_DATE_INVALID", "FLIGHT_HTTP_400", "FLIGHT_HTTP_404", "FLIGHT_HTTP_422"].includes(error?.code)) return;
      if (providers.has(provider)) lookups.set(provider, { successful: false, at: now });
    },
    balance(successful, now = Date.now()) {
      if (successful === true) { balanceSucceededAt = now; balanceFailureAt = null; }
      else balanceFailureAt = now;
    },
    snapshot(configuration, alerts, balance, balanceCheckedAt, now = Date.now()) {
      const observation = lookups.get(configuration.provider);
      const lookupStatus = !configuration.configured || !observation ? "unknown" : !observation.successful ? "degraded" : recent(observation.at, now) ? "operational" : "unknown";
      let alertsStatus = "not_enabled";
      if (configuration.provider === "aerodatabox" && alerts.enabled) {
        const checkedAt = typeof balanceCheckedAt === "string" ? Date.parse(balanceCheckedAt) : NaN;
        const latestSuccess = Math.max(Number.isFinite(checkedAt) ? checkedAt : -Infinity, balanceSucceededAt ?? -Infinity);
        alertsStatus = !alerts.configured ? "degraded" : balanceFailureAt !== null && balanceFailureAt >= latestSuccess ? "degraded" :
          balance === 0 && Number.isFinite(checkedAt) && checkedAt <= now ? "degraded" :
            !recent(checkedAt, now) || !Number.isFinite(balance) || balance < 0 ? "unknown" : "operational";
      }
      const status = !configuration.configured ? "unknown" : [lookupStatus, alertsStatus].includes("degraded") ? "degraded" :
        lookupStatus === "operational" && ["operational", "not_enabled"].includes(alertsStatus) ? "operational" : "unknown";
      return { schemaVersion: 1, status, lookupStatus, alertsStatus,
        lastLookupAt: observation && Number.isFinite(observation.at) ? new Date(observation.at).toISOString() : null };
    },
  };
}
