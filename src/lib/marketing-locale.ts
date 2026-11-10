export type MarketingLocale = "nl-NL" | "en-GB";
export const MARKETING_PATHS = ["/", "/about", "/features", "/for-travelers", "/for-groups", "/pricing"] as const;
export type MarketingPath = typeof MARKETING_PATHS[number];

export function marketingPageForOrigin(pathname: string, origin?: string) {
  if (!origin) return null;
  try {
    const hostname = new URL(origin).hostname;
    if (!["globetrotr.nl", "www.globetrotr.nl", "localhost", "127.0.0.1", "[::1]"].includes(hostname)) return null;
    return marketingPage(pathname);
  } catch { return null; }
}

export function marketingPage(pathname: string): { path: MarketingPath; locale: MarketingLocale } | null {
  const english = pathname === "/en" || pathname.startsWith("/en/");
  let path = english ? pathname.slice(3) || "/" : pathname;
  path = path !== "/" ? path.replace(/\/$/, "") : path;
  if (!english && path === "/mogelijkheden") path = "/features";
  if (!english && path === "/prijzen") path = "/pricing";
  return MARKETING_PATHS.includes(path as MarketingPath) ? { path: path as MarketingPath, locale: english ? "en-GB" : "nl-NL" } : null;
}

/** Only verified marketing pages are localized; app, API and unknown paths stay intact. */
export function localizedMarketingPath(pathname: string, locale: MarketingLocale): string {
  const page = marketingPage(pathname);
  if (!page) return pathname;
  return locale === "en-GB" ? `/en${page.path === "/" ? "" : page.path}` : page.path;
}
