import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, CircleHelp, CircleX, History, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadPublicPlatformStatus } from "@/lib/platform-status-client";
import { useLocale } from "@/lib/locale";
import { platformStatusFreshness } from "@/lib/platform-status";

type Service = { key: string; nameNl: string; nameEn: string; status: string; checkedAt: string | null; statusBasis?: string };

export function PlatformServiceOverview() {
  const { text } = useLocale();
  const query = useQuery({ queryKey: ["public-platform-status"], queryFn: async () => await loadPublicPlatformStatus() as { components: Service[] }, refetchInterval: 30_000 });
  return <Card>
    <CardHeader><CardTitle>{text("Diensten op de statuspagina", "Status page services")}</CardTitle><p className="text-sm text-muted-foreground">{text("Online, verminderde werking en offline per dienst. Publiceer gedeeltelijke storingen, incidentupdates en herstel via de bestaande Meldingen.", "Online, degraded and offline for each service. Publish partial outages, incident updates and recovery through existing Notifications.")}</p><a href="/corporate-admin/notifications" className="text-sm underline underline-offset-4">{text("Incidenten en updates beheren", "Manage incidents and updates")}</a></CardHeader>
    <CardContent className="space-y-3">
      {query.isPending && <p className="text-sm text-muted-foreground">{text("Diensten laden…", "Loading services…")}</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">{text("Diensten konden niet worden geladen. Beschikbaarheid is niet bevestigd.", "Services could not be loaded. Availability is unconfirmed.")}</p>}
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />{text("Diensten vernieuwen", "Refresh services")}</Button>
      {!query.isError && (query.data?.components as Service[] | undefined)?.map(item => {
        const { status } = item.key === "flights" && item.statusBasis === "incidents" ? { status: item.status } : platformStatusFreshness(item.status, item.checkedAt, Date.now(), ["web", "portal", "sso", "mail_https"].includes(item.key) ? 15 * 60_000 : 90 * 60_000);
        const Icon = status === "operational" ? CheckCircle2 : status === "outage" ? CircleX : status === "unknown" ? CircleHelp : status === "maintenance" ? CalendarClock : TriangleAlert;
        const label = status === "operational" ? text("Online", "Online") : status === "outage" ? text("Offline", "Offline") : status === "unknown" ? text("Niet bevestigd", "Unconfirmed") : status === "maintenance" ? text("Onderhoud", "Maintenance") : text("Verminderde werking", "Degraded");
        return <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <Icon className={`size-5 shrink-0 ${status === "operational" ? "text-emerald-600 dark:text-emerald-300" : status === "outage" ? "text-destructive" : status === "degraded" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`} />
          <div className="min-w-0 flex-1"><strong>{text(item.nameNl, item.nameEn)}</strong><p className="text-xs text-muted-foreground">{label}</p></div>
          <a href={`https://status.globetrotr.nl/#service-${item.key}`} className="inline-flex items-center gap-1 text-sm underline underline-offset-4"><History className="size-4" />{text("Historie en updates", "History and updates")}</a>
        </div>;
      })}
    </CardContent>
  </Card>;
}
