/** Return a platform-controlled Agency label, or null for a custom hostname. */
export function agencySubdomainForTls(domain) {
  if (typeof domain !== "string" || domain.length > 253 || domain !== domain.toLowerCase()) return null;
  return /^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)\.globetrotr\.nl$/.exec(domain)?.[1] ?? null;
}

export function agencyDomainFilter(domain) {
  if (typeof domain !== "string" || domain.length > 253 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) return null;
  const subdomain = agencySubdomainForTls(domain);
  return subdomain
    ? `subdomain=eq.${encodeURIComponent(subdomain)}`
    : `custom_domain=eq.${encodeURIComponent(domain)}&verification_status=eq.verified`;
}
