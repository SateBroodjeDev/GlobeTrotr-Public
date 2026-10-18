import { useEffect, useState } from "react";

export type PortalSessionSummary = {
  authenticated: true;
  displayName: string;
  avatarUrl?: string;
};

const STORAGE_KEY = "globetrotr.portal-session-summary";
const PORTAL_ORIGIN = "https://portal.globetrotr.nl";

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

  useEffect(() => {
    const isPublicHost = ["globetrotr.nl", "www.globetrotr.nl"].includes(window.location.hostname);
    setPublicHost(isPublicHost);
    if (!isPublicHost) { setChecked(true); setVerified(true); return; }
    const cached = readCachedSummary();
    if (cached) { setSummary(cached); setChecked(true); }
    const timeout = window.setTimeout(() => setChecked(true), 4_000);
    const receive = (event: MessageEvent) => {
      if (event.origin !== PORTAL_ORIGIN || event.data?.type !== "globetrotr:session-summary") return;
      const frame = document.querySelector<HTMLIFrameElement>('iframe[src="https://portal.globetrotr.nl/session-bridge"]');
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
      const next = event.data.summary as PortalSessionSummary | null;
      if (next !== null && (next?.authenticated !== true || typeof next.displayName !== "string")) return;
      if (next?.authenticated === true && typeof next.displayName === "string") {
        setSummary(next);
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
    window.addEventListener("message", receive);
    return () => { window.clearTimeout(timeout); window.removeEventListener("message", receive); };
  }, []);

  return { publicHost, summary, checked, verified };
}
