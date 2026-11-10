import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { agencyHostLookup } from "@/lib/agency-domain";
import { getPublicAgencyHostBranding } from "@/lib/agency-host-branding";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";

/** Do not paint generic or another workspace's branding while resolving a host. */
export function AgencyBrandingBoundary({ children }: { children: ReactNode }) {
  const { text } = useLocale();
  const origin = useRouter().options.origin ?? (typeof window === "undefined" ? undefined : window.location.origin);
  let hostname = "";
  try { if (origin) hostname = new URL(origin).hostname.toLowerCase(); } catch { /* No trusted host yet. */ }
  const agencyHost = Boolean(hostname && agencyHostLookup(hostname));
  const branding = useQuery({
    queryKey: ["public-agency-host-branding", hostname],
    queryFn: () => getPublicAgencyHostBranding(hostname),
    enabled: agencyHost, retry: false, staleTime: 60_000,
  });
  const [applied, setApplied] = useState("");
  const identity = branding.data ? JSON.stringify([hostname, branding.data.workspaceId,
    branding.data.brandName, branding.data.accent, branding.data.logoPath]) : "";
  useEffect(() => {
    if (!agencyHost || !branding.data || !identity) return;
    // Apply theme before revealing the shell, including on a warm query cache.
    document.documentElement.style.setProperty("--brand-hue", String(branding.data.accent));
    document.documentElement.dataset.platformBrand = "agency";
    setApplied(identity);
  }, [agencyHost, branding.data, identity]);
  if (hostname && !agencyHost) return <>{children}</>;
  if (branding.data && identity && applied === identity) return <>{children}</>;
  const failed = agencyHost && !branding.isPending && !branding.data;
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <div className="max-w-sm space-y-4 text-center" role="status" aria-live="polite" aria-busy={!failed}>
      {failed ? <>
        <p className="text-sm text-muted-foreground">{text("Dit portaal kon niet worden geladen. Probeer het opnieuw.", "This portal could not be loaded. Please try again.")}</p>
        <Button type="button" variant="outline" disabled={branding.isFetching} onClick={() => void branding.refetch()}>
          {text("Opnieuw proberen", "Try again")}
        </Button>
      </> : <>
        <div aria-hidden="true" className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 rounded-full bg-foreground/20 motion-safe:animate-pulse"/>
        </div>
        <span className="sr-only">{text("Portaal laden…", "Loading portal…")}</span>
      </>}
    </div>
  </main>;
}
