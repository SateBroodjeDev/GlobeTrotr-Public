import { useEffect, useState } from "react";
import { supportedLocale, type SupportedLocale } from "./locale-policy.ts";

export type PortalSessionSummary = {
  authenticated: true;
  displayName: string;
  avatarUrl?: string;
  locale?: SupportedLocale;
};

const STORAGE_KEY = "globetrotr.portal-session-summary";
const PORTAL_ORIGIN = "https://portal.globetrotr.nl";

function portalFrame() {
  return document.querySelector<HTMLIFrameElement>('iframe[src="https://portal.globetrotr.nl/session-bridge"]');
}

export function isPortalMessage(event: MessageEvent) {
  return event.origin === PORTAL_ORIGIN && Boolean(portalFrame()?.contentWindow) && event.source === portalFrame()?.contentWindow;
}

/** Only a language value crosses hosts; authentication stays inside the portal. */
export function savePortalLocale(locale: SupportedLocale): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = portalFrame();
    if (!frame?.contentWindow) { reject(new Error("Portal unavailable")); return; }
    const requestId = crypto.randomUUID();
    const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener("message", receive); };
    const receive = (event: MessageEvent) => {
      if (!isPortalMessage(event) || event.data?.type !== "globetrotr:locale-saved" || event.data.requestId !== requestId) return;
      cleanup();
      if (event.data.success === true) resolve();
      else reject(new Error("Language could not be saved"));
    };
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Portal unavailable")); }, 10_000);
    window.addEventListener("message", receive);
    frame.contentWindow.postMessage({ type: "globetrotr:set-locale", locale, requestId }, PORTAL_ORIGIN);
  });
}

function readCachedSummary(): PortalSessionSummary | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as PortalSessionSummary | null;
    return value?.authenticated === true && typeof value.displayName === "string" ? value : undefined;
  } catch { return undefined; }
}

export function usePortalSessionSummary() {
  // Keep the server render and first browser render identical. This also
  // prevents sign-in buttons or initials flashing before the real state wins.
  const [publicHost, setPublicHost] = useState(false);
  const [summary, setSummary] = useState<PortalSessionSummary>();
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const isPublicHost = ["globetrotr.nl", "www.globetrotr.nl"].includes(window.location.hostname);
    setPublicHost(isPublicHost);
    if (!isPublicHost) { setChecked(true); setVerified(true); return; }
    const cached = readCachedSummary();
    if (cached) { setSummary(cached); setChecked(true); }
    const timeout = window.setTimeout(() => { setChecked(true); setTimedOut(true); }, 4_000);
    const receive = (event: MessageEvent) => {
      if (!isPortalMessage(event) || event.data?.type !== "globetrotr:session-summary") return;
      const next = event.data.summary as PortalSessionSummary | null;
      if (next !== null && (next?.authenticated !== true || typeof next.displayName !== "string")) return;
      if (next?.authenticated === true && typeof next.displayName === "string") {
        const validated = { ...next, locale: supportedLocale(next.locale) };
        setSummary(validated);
        try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
        catch { /* Live verified state remains usable when preference storage is blocked. */ }
      } else {
        setSummary(undefined);
        try { window.sessionStorage.removeItem(STORAGE_KEY); }
        catch { /* No local cache is needed to verify the live guest state. */ }
      }
      setChecked(true);
      setVerified(true);
      window.clearTimeout(timeout);
    };
    const refresh = () => portalFrame()?.contentWindow?.postMessage({ type: "globetrotr:session-request" }, PORTAL_ORIGIN);
    window.addEventListener("message", receive);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  return { publicHost, summary, checked, verified, languageReady: !publicHost || verified || timedOut };
}
