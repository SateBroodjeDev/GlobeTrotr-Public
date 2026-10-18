import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, RotateCcw, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPlatformOperations, runPlatformHealthChecks, setPlatformProviderEnabled } from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/status")({ component: StatusPage });

const labels: Record<string, [string, string]> = {
  weather: ["Weer", "Weather"], flight_lookup: ["Vluchtinformatie", "Flight data"], routing: ["Routes", "Routing"],
  email: ["E-mail", "Email"], domain_verification: ["Domeincontrole", "Domain verification"], object_storage: ["Objectopslag", "Object storage"],
  mail_server: ["Mailserver", "Mail server"],
};

function StatusPage() {
  const { text } = useLocale();
  const client = useQueryClient();
  const [health, setHealth] = useState<any>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const operations = useQuery({ queryKey: ["platform-operations"], queryFn: () => getPlatformOperations() });
  const check = useMutation({ mutationFn: () => runPlatformHealthChecks(), onSuccess: setHealth, onError: () => toast.error(text("Platformcontrole is mislukt.", "Platform check failed.")) });
  const toggle = useMutation({
    mutationFn: (input: { provider: string; enabled: boolean; reason: string }) => setPlatformProviderEnabled({ data: input }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["platform-operations"] }); toast.success(text("Providerstatus bijgewerkt.", "Provider status updated.")); },
    onError: () => toast.error(text("Providerstatus kon niet worden bijgewerkt.", "Provider status could not be updated.")),
  });
  return <div className="space-y-6">
    <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>{text("Platformstatus", "Platform status")}</CardTitle>{health && <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(health.checkedAt))}</p>}</div><Button variant="outline" disabled={check.isPending} onClick={() => check.mutate()}><RefreshCw className={`size-4 ${check.isPending ? "animate-spin" : ""}`} />{check.isPending ? text("Controleren…", "Checking…") : text("Nu controleren", "Check now")}</Button></CardHeader><CardContent>{health ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{health.checks.map((item: any) => <div key={item.name} className="flex items-center gap-3 rounded-xl border p-4"><span className={`size-2.5 rounded-full ${item.status === "operational" ? "bg-emerald-500" : item.status === "not_configured" ? "bg-slate-400" : "bg-red-500"}`} /><div><strong className="capitalize">{item.name}</strong><p className="text-xs text-muted-foreground">{item.status}{item.durationMs ? ` · ${item.durationMs} ms` : ""}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">{text("Voer een handmatige controle uit.", "Run a manual check.")}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5" />{text("Externe providers", "External providers")}</CardTitle></CardHeader><CardContent className="space-y-3">{operations.isLoading && <p className="text-sm text-muted-foreground">{text("Laden…", "Loading…")}</p>}{operations.isError && <p className="text-sm text-destructive">{text("Platformstatus kon niet worden geladen. Probeer het opnieuw.", "Platform status could not be loaded. Try again.")}</p>}{operations.data?.providers.map((provider: any) => { const label = labels[provider.provider] ?? [provider.provider, provider.provider]; return <div key={provider.provider} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_120px_minmax(220px,1fr)_auto] md:items-center"><div><strong>{text(label[0], label[1])}</strong><p className="text-xs text-muted-foreground">{provider.calls7d} {text("aanvragen in 7 dagen", "requests in 7 days")}</p></div><span className={`text-sm font-medium ${provider.enabled ? "text-emerald-600" : "text-destructive"}`}>{provider.enabled ? text("Actief", "Active") : text("Geblokkeerd", "Disabled")}</span><Input value={reason[provider.provider] ?? provider.reason ?? ""} onChange={(event) => setReason((current) => ({ ...current, [provider.provider]: event.target.value }))} placeholder={text("Verplichte reden bij blokkeren", "Required reason when disabling")} maxLength={240} /><Button variant={provider.enabled ? "destructive" : "outline"} disabled={toggle.isPending} onClick={() => toggle.mutate({ provider: provider.provider, enabled: !provider.enabled, reason: reason[provider.provider] ?? provider.reason ?? "" })}>{provider.enabled ? <ShieldOff className="size-4" /> : <RotateCcw className="size-4" />}{provider.enabled ? text("Blokkeren", "Disable") : text("Herstellen", "Restore")}</Button></div>; })}</CardContent></Card>
    <Card><CardHeader><CardTitle>{text("Mislukte workeropdrachten", "Failed worker jobs")}</CardTitle></CardHeader><CardContent>{operations.data?.failedJobs.length ? <div className="space-y-2">{operations.data.failedJobs.map((job: any) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span><strong>{job.job_type}</strong> · {job.provider}</span><span className="text-muted-foreground">{job.last_error_code ?? job.status} · {job.attempts}/10</span></div>)}</div> : <p className="text-sm text-muted-foreground">{text("Geen mislukte opdrachten gevonden.", "No failed jobs found.")}</p>}</CardContent></Card>
  </div>;
}
