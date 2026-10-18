import { PRIVACY_PURPOSE_VERSION, readSharedPrivacyChoice } from "./privacy-sync.ts";
export const ANALYTICS_ID = "G-XVXEWHX1XS";
export const PORTAL_ANALYTICS_ID = "G-38JYPT376N";
export const ANALYTICS_CHOICE_KEY = "globetrotr.analytics-choice.v1";
export const ANALYTICS_CONSENT_KEY = "globetrotr.analytics-consent.v1";
export const ANALYTICS_PURPOSE_VERSION = PRIVACY_PURPOSE_VERSION;
export type AnalyticsConsent = { version: 1; allowed: boolean; decidedAt: string; purposeVersion: string };
const pages = new Set(["/", "/features", "/mogelijkheden", "/demo", "/for-travelers", "/for-groups", "/for-agencies", "/pricing", "/prijzen", "/about", "/contact", "/support", "/roadmap", "/updates", "/changelog", "/privacy", "/terms", "/refund-policy"]);
const portalPages = new Set(["/dashboard", "/team", "/analytics", "/agency-admin", "/agency-admin/operations", "/agency-admin/clients", "/agency-admin/suppliers", "/agency-admin/notifications"]);
export function analyticsTarget(host: string, path: string, search = "", hash = "") {
  if (search || hash) return null;
  if (host === "globetrotr.nl" && pages.has(path))
    return { id: ANALYTICS_ID, origin: "https://globetrotr.nl", page: path, cookiePrefix: "gt_public" };
  if (host === "portal.globetrotr.nl" && portalPages.has(path))
    return { id: PORTAL_ANALYTICS_ID, origin: "https://portal.globetrotr.nl", page: path, cookiePrefix: "gt_portal" };
  return null;
}
export function analyticsPage(host: string, path: string, search = "", hash = "") {
  return analyticsTarget(host, path, search, hash)?.page ?? null;
}
export function analyticsAction(value: string | null) {
  return value && ["registration_click", "demo_click", "pricing_click", "agency_click", "demo_beach", "demo_citytrip", "demo_roadtrip", "demo_add_stop", "demo_remove_stop", "demo_reset", "demo_memory_preview", "contact_submitted", "trip_created", "agency_client_created", "agency_supplier_created", "trip_open_click", "team_open_click", "agency_operations_click", "agency_clients_click", "agency_suppliers_click"].includes(value) ? value : null;
}
const completedActions: Record<string, { host: string; page: string }> = {
  contact_submitted: { host: "globetrotr.nl", page: "/contact" },
  trip_created: { host: "portal.globetrotr.nl", page: "/dashboard" },
  agency_client_created: { host: "portal.globetrotr.nl", page: "/agency-admin/clients" },
  agency_supplier_created: { host: "portal.globetrotr.nl", page: "/agency-admin/suppliers" },
};
/** Build the complete payload from fixed values; no caller-supplied parameters. */
export function analyticsEventParameters(host: string, path: string, event: string, search = "", hash = "") {
  const target = analyticsTarget(host, path, search, hash);
  if (!target || (event !== "page_view" && !analyticsAction(event))) return null;
  const completed = completedActions[event];
  const portalAction = event.startsWith("trip_") || event.startsWith("team_") || (event.startsWith("agency_") && event !== "agency_click");
  if (completed && (completed.host !== host || completed.page !== path)) return null;
  if (event !== "page_view" && !completed && portalAction !== (host === "portal.globetrotr.nl")) return null;
  if (event.startsWith("demo_") && !event.endsWith("_click") && path !== "/demo" && path !== "/") return null;
  return {
    send_to: target.id, page_location: `${target.origin}${target.page}`, page_referrer: "",
    page_title: "GlobeTrotr", page_path: target.page,
    measurement_scope: host === "portal.globetrotr.nl" ? "portal" : "public",
    action_type: event === "page_view" ? "page_view" : completed ? "success" : event.endsWith("_click") ? "navigation" : "demo",
  };
}
export function analyticsLink(href: string, host = "globetrotr.nl") {
  try {
    const url = new URL(href, `https://${host}`);
    if (host === "portal.globetrotr.nl") {
      if (url.origin !== "https://portal.globetrotr.nl") return null;
      if (/^\/trips\/[^/]+$/.test(url.pathname)) return "trip_open_click";
      return ({ "/team": "team_open_click", "/agency-admin/operations": "agency_operations_click", "/agency-admin/clients": "agency_clients_click", "/agency-admin/suppliers": "agency_suppliers_click" } as Record<string, string>)[url.pathname] ?? null;
    }
    if (host !== "globetrotr.nl") return null;
    if (url.origin === "https://portal.globetrotr.nl" && url.pathname === "/register") return "registration_click";
    if (url.origin !== "https://globetrotr.nl") return null;
    return ({ "/demo": "demo_click", "/pricing": "pricing_click", "/prijzen": "pricing_click", "/for-agencies": "agency_click" } as Record<string, string>)[url.pathname] ?? null;
  } catch { return null; }
}
/** Only a fixed event name crosses the boundary; never pass trip/user data. */
export function trackAnalyticsAction(action: string) {
  const safe = analyticsAction(action);
  if (typeof window !== "undefined" && safe && readAnalyticsChoice() === true)
    window.dispatchEvent(new CustomEvent("globetrotr:analytics-action", { detail: safe }));
}
let sessionChoice: boolean | null = null;
let sessionConsent: AnalyticsConsent | null = null;
export function parseAnalyticsConsent(value: string | null): AnalyticsConsent | null {
  try {
    const record = JSON.parse(value ?? "null");
    if (record?.version !== 1 || typeof record.allowed !== "boolean" || record.purposeVersion !== ANALYTICS_PURPOSE_VERSION ||
      typeof record.decidedAt !== "string" || !Number.isFinite(Date.parse(record.decidedAt)) || Date.parse(record.decidedAt) > Date.now() + 60_000 ||
      (record.allowed && Date.now() - Date.parse(record.decidedAt) >= 365 * 86400_000)) return null;
    return { version: 1, allowed: record.allowed, decidedAt: record.decidedAt, purposeVersion: record.purposeVersion };
  } catch { return null; }
}
export function readAnalyticsChoice(): boolean | null {
  if (typeof window === "undefined") return null;
  const shared = readSharedPrivacyChoice();
  if (shared) return shared.analytics;
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CHOICE_KEY);
    // A refusal also wins if persisting the companion record was interrupted.
    if (stored === "false") return false;
    const consent = parseAnalyticsConsent(window.localStorage.getItem(ANALYTICS_CONSENT_KEY));
    if (consent) return consent.allowed;
    // Legacy refusals remain respected; legacy opt-ins need a dated new choice.
    return sessionConsent?.allowed ?? sessionChoice;
  } catch { return sessionChoice; }
}
export function saveAnalyticsChoice(allowed: boolean, decidedAt = new Date().toISOString()) {
  sessionChoice = allowed;
  sessionConsent = { version: 1, allowed, decidedAt, purposeVersion: ANALYTICS_PURPOSE_VERSION };
  try {
    window.localStorage.setItem(ANALYTICS_CHOICE_KEY, String(allowed));
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(sessionConsent));
  } catch { /* Session-only choice when storage is unavailable. */ }
  window.dispatchEvent(new Event("globetrotr:analytics-choice"));
}
export function clearAnalyticsChoice() {
  sessionChoice = null; sessionConsent = null;
  try { window.localStorage.removeItem(ANALYTICS_CHOICE_KEY); window.localStorage.removeItem(ANALYTICS_CONSENT_KEY); } catch { /* Blocked storage. */ }
  window.dispatchEvent(new Event("globetrotr:analytics-choice"));
}
