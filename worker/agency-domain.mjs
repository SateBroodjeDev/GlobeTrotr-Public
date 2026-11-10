// Keep platform infrastructure outside tenant routing, including before DNS activation.
export const reservedAgencyLabels = new Set([
  "portal", "www", "dashboard", "mail", "smtp", "status", "support", "help",
  "cdn", "assets", "auth", "login", "app", "api", "admin", "dev", "sso",
  "mta-sts", "customers", "agency-origin",
]);
export const agencyCloudflareTarget = "customers.globetrotr.nl";

/** Return a platform-controlled Agency label, or null for a custom hostname. */
export function agencySubdomainForTls(domain) {
  if (typeof domain !== "string" || domain.length > 253 || domain !== domain.toLowerCase()) return null;
  const label = /^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)\.globetrotr\.nl$/.exec(domain)?.[1];
  return label && !reservedAgencyLabels.has(label) ? label : null;
}

export function agencyDomainFilter(domain) {
  if (typeof domain !== "string" || domain.length > 253 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) return null;
  const subdomain = agencySubdomainForTls(domain);
  if (domain === "globetrotr.nl" || (domain.endsWith(".globetrotr.nl") && !subdomain)) return null;
  return subdomain
    ? `subdomain=eq.${encodeURIComponent(subdomain)}`
    : `custom_domain=eq.${encodeURIComponent(domain)}&verification_status=eq.verified`;
}

/** Public DNS evidence; shared CDN IP addresses never prove routing or ownership. */
export function agencyDnsEvidence(cnames, txtRecords, token, cloudflare = false) {
  const targets = cloudflare
    ? [agencyCloudflareTarget]
    : ["globetrotr.nl", "dashboard.globetrotr.nl", "portal.globetrotr.nl", agencyCloudflareTarget];
  return {
    cnameOk: cnames.some((name) => typeof name === "string" && targets.includes(name.toLowerCase().replace(/\.$/, ""))),
    txtOk: typeof token === "string" && /^[0-9a-f-]{36}$/i.test(token)
      && txtRecords.some((parts) => Array.isArray(parts) && parts.join("") === `globetrotr-verification=${token}`),
  };
}
