import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, Clock3 } from "lucide-react";
import { getAgencyLoginStatus } from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";

export function AgencyLoginStatus({ workspaceId, generation, enabled = true }: {
  workspaceId: string; generation: string; enabled?: boolean;
}) {
  const { text } = useLocale();
  const query = useQuery({ queryKey: ["agency-login-status", workspaceId, generation],
    queryFn: () => getAgencyLoginStatus(), enabled, retry: false,
    refetchInterval: 15000, refetchOnWindowFocus: true });
  if (!enabled) return null;
  return <div className="space-y-2 text-xs" aria-live="polite">
    <p className="font-medium">{text("Inloggen via Google en Discord", "Google and Discord sign-in")}</p>
    {query.isError ? <p className="text-muted-foreground">{text("Inlogcontrole tijdelijk niet beschikbaar.", "Sign-in check temporarily unavailable.")}</p>
      : query.isPending ? <p className="text-muted-foreground">{text("Inloginstellingen controleren…", "Checking sign-in settings…")}</p>
        : query.data?.map(({ hostname, state }) => <div key={hostname} className="flex items-start gap-2">
          {state === "ready" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"/>
            : state === "pending" || state === "dns_pending" ? <Clock3 className="size-4 shrink-0 text-muted-foreground"/>
              : <CircleHelp className="size-4 shrink-0 text-muted-foreground"/>}
          <p className="min-w-0"><span className="block break-all font-medium">{hostname}</span>
            <span className="text-muted-foreground">{state === "ready" ? text("Inlogredirects ingesteld en gecontroleerd.", "Sign-in redirects configured and checked.")
              : state === "dns_pending" ? text("Eerst de domeinverificatie afronden.", "Complete domain verification first.")
                : state === "pending" ? text("Inloginstellingen worden automatisch bijgewerkt.", "Sign-in settings are being updated automatically.")
                  : state === "unconfigured" ? text("Automatische inlogcontrole is nog niet ingesteld.", "Automatic sign-in checking has not been configured yet.")
                    : state === "error" ? text("Inlogcontrole niet geslaagd. GlobeTrotr-beheer moet de koppeling controleren.", "Sign-in check failed. GlobeTrotr support needs to check the connection.")
                      : text("Nog geen recente bevestiging van de inloginstellingen.", "No recent confirmation of the sign-in settings.")}</span></p>
        </div>)}
  </div>;
}
