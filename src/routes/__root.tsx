import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { LocaleProvider } from "@/lib/locale";
import { PrivacyChoices } from "@/components/PrivacyChoices";
import { PrivacySync } from "@/components/PrivacySync";
import { Analytics } from "@/components/Analytics";
import { BetaFeedbackButton } from "@/components/BetaFeedbackButton";
import { canonicalSiteLocation, publicSiteUrl } from "@/lib/site-routing";
import "leaflet/dist/leaflet.css";
import { agencyHostLookup } from "@/lib/agency-domain";

function NotFoundComponent() {
  const text = useFallbackText();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{text("Pagina niet gevonden", "Page not found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {text("Deze pagina bestaat niet of is verplaatst.", "The page you're looking for doesn't exist or has been moved.")}
        </p>
        <div className="mt-6">
          <a
            href={publicSiteUrl("/")}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {text("Naar de website", "Go home")}
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const text = useFallbackText();
  const router = useRouter();
  useEffect(() => {
    console.error("[Root error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {text("Deze pagina kon niet worden geladen", "This page didn't load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {text("Er ging iets mis bij het laden. Probeer het opnieuw of ga terug naar de website.", "Something went wrong while loading. Try again or head back to the website.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {text("Opnieuw proberen", "Try again")}
          </button>
          <a
            href={publicSiteUrl("/")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {text("Naar de website", "Go home")}
          </a>
        </div>
      </div>
    </div>
  );
}

// Root error views can render before LocaleProvider, so do not depend on its context.
function useFallbackText() {
  const [english, setEnglish] = useState(false);
  useEffect(() => {
    let selectedEnglish = document.documentElement.lang.startsWith("en");
    try {
      const saved = window.sessionStorage.getItem("globetrotr.locale.session");
      if (saved === "en-GB" || saved === "nl-NL") selectedEnglish = saved === "en-GB";
    } catch { /* The document language remains usable when storage is unavailable. */ }
    setEnglish(selectedEnglish);
  }, []);
  return (nl: string, en: string) => english ? en : nl;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GlobeTrotr — Samen reizen plannen zonder chaos" },
      {
        name: "description",
        content:
          "Wereldwijde reisplanner voor vriendengroepen met routekaart, gedeelde uitgaven, live weer en paklijsten.",
      },
      { property: "og:title", content: "GlobeTrotr — Samen reizen plannen zonder chaos" },
      {
        property: "og:description",
        content: "Plan elke reis ter wereld en verantwoord elke euro.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "GlobeTrotr" },
      { property: "og:locale", content: "nl_NL" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0f766e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("globetrotr.theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sessionBridge = pathname === "/session-bridge";
  const [agencyHost, setAgencyHost] = useState(false);
  useEffect(() => {
    setAgencyHost(Boolean(agencyHostLookup(window.location.hostname)));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <WorkspaceProvider>
            <CanonicalOrigin>
              {sessionBridge ? (
                <Outlet />
              ) : (
                <AppShell>
                  {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                  <Outlet />
                </AppShell>
              )}
              {!sessionBridge && <PrivacySync><PrivacyChoices /><Analytics /></PrivacySync>}
              {!sessionBridge && !agencyHost && <BetaFeedbackButton />}
            </CanonicalOrigin>
          </WorkspaceProvider>
        </LocaleProvider>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function CanonicalOrigin({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (state) => state.location });
  useEffect(() => {
    const target = canonicalSiteLocation(
      window.location.hostname,
      location.pathname,
      location.searchStr,
      location.hash,
    );
    if (target) window.location.replace(target);
  }, [location.pathname, location.searchStr, location.hash]);
  return <>{children}</>;
}
