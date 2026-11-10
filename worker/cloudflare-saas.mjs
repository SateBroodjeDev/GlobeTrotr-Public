// Fixed Cloudflare API origin; never fetch a customer-controlled URL or return provider bodies.
export function cloudflareSaasConfig(env) {
  const value = env.CLOUDFLARE_SAAS_ENABLED ?? "false";
  if (!["true", "false"].includes(value)) throw new Error("CLOUDFLARE_CONFIGURATION_REQUIRED");
  if (value === "false") return { enabled: false };
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ZONE_ID ?? "")
    || !/^[a-zA-Z0-9_-]{20,256}$/.test(env.CLOUDFLARE_API_TOKEN ?? ""))
    throw new Error("CLOUDFLARE_CONFIGURATION_REQUIRED");
  return { enabled: true, zoneId: env.CLOUDFLARE_ZONE_ID, token: env.CLOUDFLARE_API_TOKEN };
}

/** Operator creates/removes hostnames in Cloudflare; application needs Read permission only. */
export async function cloudflareHostnameStatus(config, hostname, fetcher = fetch) {
  if (!config.enabled) return { ready: true, state: "disabled" };
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)
    || hostname.length > 253 || hostname === "globetrotr.nl" || hostname.endsWith(".globetrotr.nl"))
    throw new Error("INVALID_CUSTOM_DOMAIN");
  const url = new URL(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`);
  url.searchParams.set("hostname.exact", hostname);
  url.searchParams.set("per_page", "2");
  let response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000), redirect: "error",
    });
  } catch { throw new Error("CLOUDFLARE_CHECK_UNAVAILABLE"); }
  if (!response.ok) throw new Error(response.status === 429 ? "CLOUDFLARE_RATE_LIMITED" : "CLOUDFLARE_CHECK_UNAVAILABLE");
  let body;
  try { body = await response.json(); } catch { throw new Error("CLOUDFLARE_CHECK_UNAVAILABLE"); }
  if (body?.success !== true || !Array.isArray(body.result)) throw new Error("CLOUDFLARE_CHECK_UNAVAILABLE");
  const records = body.result.filter((record) => record?.hostname === hostname);
  if (records.length === 0) return { ready: false, state: "not_registered" };
  if (records.length !== 1) throw new Error("CLOUDFLARE_CHECK_UNAVAILABLE");
  const record = records[0];
  if (record.status !== "active") return { ready: false, state: "hostname_pending" };
  if (record.ssl?.status !== "active") return { ready: false, state: "certificate_pending" };
  return { ready: true, state: "ready" };
}
