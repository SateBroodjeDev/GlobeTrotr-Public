/** Process-local limits deliberately ignore untrusted forwarding headers. */
export function createStatsHandler(load: () => Promise<Record<string, number>>, now = Date.now) {
  let cached: { statistics: Record<string, number>; generatedAt: string } | undefined;
  let expires = 0;
  let retryAt = 0;
  let pending: Promise<void> | undefined;
  let windowStart = 0;
  let requests = 0;
  return async (enabled: boolean) => {
    const headers = { "Cache-Control": "no-store" };
    if (!enabled) return Response.json({ error: "unavailable" }, { status: 404, headers });
    const time = now();
    if (time - windowStart >= 60_000) {
      windowStart = time;
      requests = 0;
    }
    if (++requests > 120)
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    try {
      if (time >= expires) {
        if (time < retryAt) throw new Error("cooldown");
        pending ??= load()
          .then((statistics) => {
            if (Object.values(statistics).some((n) => !Number.isSafeInteger(n) || n < 0))
              throw new Error("invalid_count");
            cached = { statistics, generatedAt: new Date(now()).toISOString() };
            expires = now() + 300_000;
          })
          .catch(() => {
            retryAt = now() + 30_000;
            throw new Error("unavailable");
          })
          .finally(() => {
            pending = undefined;
          });
        await pending;
      }
      return Response.json(cached, { headers: { "Cache-Control": "public, max-age=60" } });
    } catch {
      return Response.json(
        { error: "unavailable" },
        { status: 503, headers: { ...headers, "Retry-After": "30" } },
      );
    }
  };
}
