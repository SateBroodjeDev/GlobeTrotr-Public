export const PUBLIC_SITE_ORIGIN = "https://globetrotr.nl";
export const PORTAL_ORIGIN = "https://portal.globetrotr.nl";

/** Router state can advance before browser history commits the destination. */
export function routeReloadLocation(origin: string, pathname: string, search = "", hash = "") {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) throw new Error("LOCAL_ROUTE_REQUIRED");
  const target = new URL(pathname, origin);
  if (target.origin !== new URL(origin).origin) throw new Error("LOCAL_ROUTE_REQUIRED");
  target.search = search;
  target.hash = hash;
  return target.href;
}

const portalPaths =
  /^\/(?:auth|register|reset-password|team-login|oauth-callback|complete-profile|session-bridge|token|dashboard|trips|account|billing|agency-admin|corporate-admin|company-mail|branding|team|analytics|client-portal|invite|uitnodiging|agency-invite|agency-uitnodiging)(?:\/|$)/;
const websitePaths =
  /^\/(?:demo|features|mogelijkheden|prijzen|pricing|about|for-groups|for-travelers|for-agencies|roadmap|updates|changelog|privacy|report-content|algemene-voorwaarden|terms|beta-voorwaarden|terugbetalingsbeleid|refund-policy|beta|known-issues|bekende-problemen|trip|reis|quote)(?:\/|$)/;

/** Keep application entry points on the portal without moving public links or secrets in the URL. */
export function canonicalSiteLocation(hostname: string, pathname: string, search = "", hash = "") {
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) return null;
  const platformHost = [
    "globetrotr.nl",
    "www.globetrotr.nl",
    "portal.globetrotr.nl",
    "dashboard.globetrotr.nl",
  ].includes(hostname);
  if (hostname === "globetrotr.nl" && portalPaths.test(pathname))
    return `${PORTAL_ORIGIN}${pathname}${search}${hash}`;
  if (hostname === "portal.globetrotr.nl" && pathname === "/")
    return `${PORTAL_ORIGIN}/dashboard${search}${hash}`;
  if (hostname === "portal.globetrotr.nl" && websitePaths.test(pathname))
    return `${PUBLIC_SITE_ORIGIN}${pathname}${search}${hash}`;
  if (
    !platformHost &&
    (pathname === "/" ||
      websitePaths.test(pathname) ||
      /^\/(?:contact|status)(?:\/|$)/.test(pathname))
  )
    return `https://${hostname}/agency-admin${search}${hash}`;
  return null;
}

export function portalUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("PORTAL_PATH_REQUIRED");
  return `${PORTAL_ORIGIN}${path}`;
}

export function publicSiteUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("PUBLIC_SITE_PATH_REQUIRED");
  return `${PUBLIC_SITE_ORIGIN}${path}`;
}
