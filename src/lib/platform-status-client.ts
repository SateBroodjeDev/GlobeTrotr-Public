/** Public data only: share the external cache instead of polling Supabase per tab. */
export async function loadPublicPlatformStatus(): Promise<unknown> {
  const response = await fetch("https://status.globetrotr.nl/summary.json", {
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("STATUS_UNAVAILABLE");
  const data = await response.json();
  if (data?.schemaVersion !== 2 || !Array.isArray(data.components) || !data.maintenance || !data.monitoring)
    throw new Error("STATUS_UNAVAILABLE");
  return data;
}
