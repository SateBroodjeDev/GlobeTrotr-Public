type CloudflareSaasConfig = { enabled: false } | { enabled: true; zoneId: string; token: string };
export function cloudflareSaasConfig(env: Record<string, string | undefined>): CloudflareSaasConfig;
export function cloudflareHostnameStatus(config: CloudflareSaasConfig, hostname: string, fetcher?: typeof fetch): Promise<{
  ready: boolean;
  state: "disabled" | "not_registered" | "hostname_pending" | "certificate_pending" | "ready";
}>;
