import { marketingPage } from "./marketing-locale.ts";

export const PUBLIC_RUM_SCRIPT = "https://static.cloudflareinsights.com/beacon.min.js";
// Reviewed 2026-10-27. A provider change must fail closed until re-reviewed.
export const PUBLIC_RUM_INTEGRITY = "sha384-DSBfgE0somecFTMgit0M4sNXN8O0JQ/LGM3DGGPVvgXIPZvW+H1zSYjc6O83LLBv";
export const PUBLIC_RUM_COOKIE = "__Host-gt_public_performance";
export const PUBLIC_RUM_PURPOSE = "2026-10-27-public-performance";
export const PUBLIC_RUM_CHOICE_EVENT = "globetrotr:performance-choice";
const consentLifetime = 180 * 86400_000;
export type PublicRumChoice = { version: 1; allowed: boolean; decidedAt: string; purposeVersion: string };
export type PublicRumSettings = { enabled: false } | { enabled: true; token: string };

/** Runtime settings contain only a PUBLIC beacon ID, never an API credential. */
export function publicRumSettings(env: Record<string, unknown>): PublicRumSettings {
  const token = env.CLOUDFLARE_RUM_PUBLIC_TOKEN;
  if (env.NODE_ENV !== "production" || env.PREVIEW_COMMIT || env.PREVIEW_DATA_MODE
    || env.CLOUDFLARE_RUM_ENABLED !== "true" || typeof token !== "string"
    || !/^[a-f0-9]{32}$/i.test(token)) return { enabled: false };
  return { enabled: true, token };
}

/** Only fixed marketing pages; no form, demo, personal, tenant or auth routes. */
export function publicRumPage(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.host !== "globetrotr.nl" || url.username || url.password
      || url.search || url.hash || !marketingPage(url.pathname)) return null;
    return url.pathname;
  } catch { return null; }
}

export function publicRumDocument(href: string, referrer: string) {
  return publicRumPage(href) !== null && (!referrer || publicRumPage(referrer) !== null);
}

export function parsePublicRumChoice(value: string | null, now = Date.now()): PublicRumChoice | null {
  if (!value || value.length > 512) return null;
  try {
    const input = JSON.parse(value) as Partial<PublicRumChoice>;
    const at = typeof input?.decidedAt === "string" ? Date.parse(input.decidedAt) : NaN;
    if (input?.version !== 1 || typeof input.allowed !== "boolean"
      || input.purposeVersion !== PUBLIC_RUM_PURPOSE || !Number.isFinite(at)
      || at > now || now - at >= consentLifetime) return null;
    return { version: 1, allowed: input.allowed, decidedAt: input.decidedAt!, purposeVersion: PUBLIC_RUM_PURPOSE };
  } catch { return null; }
}

export function readPublicRumChoice(cookie: string, now = Date.now()) {
  const values = cookie.split(";").map(part => part.trim())
    .filter(part => part.startsWith(`${PUBLIC_RUM_COOKIE}=`));
  if (values.length !== 1) return null;
  try { return parsePublicRumChoice(decodeURIComponent(values[0].slice(PUBLIC_RUM_COOKIE.length + 1)), now); }
  catch { return null; }
}

/** Independent, host-only device choice. Existing Google/account grants do not apply. */
export function savePublicRumChoice(allowed: boolean): boolean {
  if (typeof window === "undefined" || window.location.origin !== "https://globetrotr.nl") return false;
  const choice: PublicRumChoice = { version: 1, allowed, decidedAt: new Date().toISOString(), purposeVersion: PUBLIC_RUM_PURPOSE };
  // Stop an existing runtime before changing the persisted preference.
  window.dispatchEvent(new Event(PUBLIC_RUM_CHOICE_EVENT));
  try {
    document.cookie = `${PUBLIC_RUM_COOKIE}=${encodeURIComponent(JSON.stringify(choice))}; Path=/; Max-Age=15552000; Secure; SameSite=Lax`;
    const stored = readPublicRumChoice(document.cookie);
    return stored?.allowed === allowed && stored.decidedAt === choice.decidedAt;
  } catch { return false; }
}
