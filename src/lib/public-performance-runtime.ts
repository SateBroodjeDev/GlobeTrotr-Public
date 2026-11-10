import {
  PUBLIC_RUM_CHOICE_EVENT, PUBLIC_RUM_INTEGRITY, PUBLIC_RUM_SCRIPT,
  publicRumDocument, publicRumPage, readPublicRumChoice, type PublicRumSettings,
} from "./public-performance.ts";

type Runtime = { stop: () => void };
type RumWindow = Window & { __cfBeacon?: unknown; __globetrotrPublicRum?: Runtime };

/**
 * One pinned SDK instance per full document, armed by a PREVIOUS explicit choice.
 * Its config slot is unavailable after navigation, withdrawal or expiry. The
 * reviewed SDK checks this slot before both XHR and sendBeacon delivery. A late
 * download cannot re-enable it. Never re-arm this document after it has stopped.
 */
export function startPublicRum(settings: PublicRumSettings, subscribe: (check: () => void) => void) {
  const target = window as RumWindow;
  if (target.__globetrotrPublicRum || !settings.enabled) return;
  const initial = window.location.href;
  const navigation = performance.getEntriesByType("navigation")[0];
  const choice = readPublicRumChoice(document.cookie);
  if (!navigation || navigation.name !== initial || !publicRumDocument(initial, document.referrer)
    || choice?.allowed !== true || Date.parse(choice.decidedAt) >= performance.timeOrigin) return;
  // Do not add a second beacon or take over an unrelated provider installation.
  if ("__cfBeacon" in target || document.querySelector(`script[data-cf-beacon], script[src^="${PUBLIC_RUM_SCRIPT}"]`)) return;

  let active = true;
  let sdkSettings: unknown;
  const stop = () => { active = false; sdkSettings = undefined; };
  const allowed = () => {
    const current = readPublicRumChoice(document.cookie);
    if (active && (window.location.href !== initial || publicRumPage(window.location.href) === null
      || current?.allowed !== true || current.decidedAt !== choice.decidedAt)) stop();
    return active;
  };
  try {
    Object.defineProperty(target, "__cfBeacon", {
      configurable: false,
      get: () => allowed() ? sdkSettings : undefined,
      set: (value: unknown) => { if (allowed()) sdkSettings = value; },
    });
  } catch { return; } // Optional measurement must not break the application.
  target.__globetrotrPublicRum = { stop };
  subscribe(allowed);
  target.addEventListener(PUBLIC_RUM_CHOICE_EVENT, stop);
  target.addEventListener("popstate", allowed, true);
  target.addEventListener("hashchange", allowed, true);
  target.addEventListener("focus", allowed);
  target.addEventListener("pageshow", event => { if (event.persisted) stop(); });
  document.addEventListener("visibilitychange", allowed, true);

  const script = document.createElement("script");
  script.id = "globetrotr-public-performance";
  script.defer = true;
  script.src = PUBLIC_RUM_SCRIPT;
  script.integrity = PUBLIC_RUM_INTEGRITY;
  script.crossOrigin = "anonymous";
  script.referrerPolicy = "no-referrer";
  script.dataset.cfBeacon = JSON.stringify({ token: settings.token, spa: false });
  script.onerror = stop; // Blocked/changed SDK leaves the application usable.
  try { document.head.appendChild(script); } catch { stop(); }
}
