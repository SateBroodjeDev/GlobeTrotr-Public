import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { analyticsAction, analyticsEventParameters, analyticsLink, analyticsTarget, readAnalyticsChoice } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { routeReloadLocation } from "@/lib/site-routing";
import { usePrivacySync } from "@/lib/privacy-sync-context";

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

export function Analytics() {
  const { ready } = usePrivacySync();
  const { user, loading } = useAuth();
  const location = useRouterState({ select: (state) => state.location });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    const update = () => setAllowed(readAnalyticsChoice() === true);
    update();
    window.addEventListener("globetrotr:analytics-choice", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("globetrotr:analytics-choice", update); window.removeEventListener("storage", update); };
  }, []);
  useEffect(() => {
    if (allowed === null) return;
    const profile = analyticsTarget(window.location.hostname, location.pathname, location.searchStr, location.hash);
    const authenticated = window.location.hostname !== "portal.globetrotr.nl" || Boolean(user && !loading);
    const page = authenticated ? profile?.page : null;
    const script = document.getElementById("globetrotr-analytics");
    const target = window as AnalyticsWindow;
    if (!ready || !allowed || !page) {
      lastPage.current = null;
      // Clear cookies even if withdrawal happens on an excluded account page.
      if (!allowed) {
        for (const cookie of document.cookie.split(";")) {
          const name = cookie.split("=")[0]?.trim();
          const ownPrefix = window.location.hostname === "portal.globetrotr.nl" ? "gt_portal" : "gt_public";
          if (!name || !(name.startsWith(`${ownPrefix}_`) || (window.location.hostname === "globetrotr.nl" && /^_ga(?:_|$)/.test(name)))) continue;
          for (const domain of ["", `; domain=${window.location.hostname}`, `; domain=.${window.location.hostname}`])
            document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
        }
      }
      if (script) {
        // A loaded third-party script cannot be stopped by removing its element.
        // Terminate it before rendering private routes or after withdrawal.
        window.location.replace(routeReloadLocation(window.location.origin, location.pathname, location.searchStr, location.hash));
      }
      return;
    }
    if (!profile) return;
    if (!script) {
      target.dataLayer = target.dataLayer || [];
      // Google tag's queue protocol uses an Arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      target.gtag = function () { target.dataLayer!.push(arguments); };
      target.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      target.gtag("js", new Date());
      target.gtag("config", profile.id, {
        send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
        page_location: `${profile.origin}${page}`, page_referrer: "", page_title: "GlobeTrotr",
        cookie_domain: "none", cookie_prefix: profile.cookiePrefix, cookie_expires: 60 * 60 * 24 * 365, cookie_update: false,
      });
      const element = document.createElement("script");
      element.id = "globetrotr-analytics";
      element.async = true;
      element.referrerPolicy = "no-referrer";
      element.src = `https://www.googletagmanager.com/gtag/js?id=${profile.id}`;
      document.head.appendChild(element);
    }
    const send = (event: string) => {
      if (!ready || readAnalyticsChoice() !== true) return;
      const parameters = analyticsEventParameters(window.location.hostname, window.location.pathname, event, window.location.search, window.location.hash);
      if (parameters) target.gtag?.("event", event, parameters);
    };
    if (lastPage.current !== page) { send("page_view"); lastPage.current = page; }
    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest("[data-analytics-event], a[href]") : null;
      const action = analyticsAction(element?.getAttribute("data-analytics-event") ?? null) ?? (element?.tagName === "A" ? analyticsLink(element.getAttribute("href") ?? "", window.location.hostname) : null);
      if (action) send(action);
    };
    document.addEventListener("click", click);
    const submit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const action = analyticsAction(event.target.getAttribute("data-analytics-submit"));
      if (action && event.target.checkValidity()) send(action);
    };
    document.addEventListener("submit", submit);
    const action = (event: Event) => {
      const name = event instanceof CustomEvent && typeof event.detail === "string" ? analyticsAction(event.detail) : null;
      if (name) send(name);
    };
    window.addEventListener("globetrotr:analytics-action", action);
    return () => { document.removeEventListener("click", click); document.removeEventListener("submit", submit); window.removeEventListener("globetrotr:analytics-action", action); };
  }, [allowed, ready, location.pathname, location.searchStr, location.hash, user, loading]);
  return null;
}
