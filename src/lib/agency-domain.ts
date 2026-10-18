const platformSuffix = ".globetrotr.nl";
const platformLabels = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const reserved = new Set([
  "portal",
  "www",
  "dashboard",
  "mail",
  "smtp",
  "status",
  "support",
  "help",
  "cdn",
  "assets",
  "auth",
  "login",
  "app",
  "api",
  "admin",
]);
const platformHosts = new Set([
  "globetrotr.nl",
  "www.globetrotr.nl",
  "portal.globetrotr.nl",
  "dashboard.globetrotr.nl",
]);

export function agencyHostLookup(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(host) || platformHosts.has(host)) return null;
  if (host.endsWith(platformSuffix)) {
    const subdomain = host.slice(0, -platformSuffix.length);
    if (!platformLabels.test(subdomain) || reserved.has(subdomain)) return null;
    return { host, subdomain, customDomain: null, requiresVerification: false } as const;
  }
  return { host, subdomain: null, customDomain: host, requiresVerification: true } as const;
}
