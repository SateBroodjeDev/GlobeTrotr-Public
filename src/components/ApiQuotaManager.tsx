import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { diagnoseBookingProvider, getApiQuotaAdminData, resetExternalApiQuota } from "@/lib/platform-operations.functions";
import { useLocale } from "@/lib/locale";

const providerLabels: Record<string, [string, string]> = {
  weather: ["Weer", "Weather"],
  flight_lookup: ["Vluchtinformatie", "Flight data"],
  routing: ["Routeberekeningen", "Route calculations"],
};

export function ApiQuotaManager({ workspaceId: fixedWorkspaceId, userId: fixedUserId }: { workspaceId?: string; userId?: string }) {
  const { text } = useLocale();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["api-quota-admin"], queryFn: () => getApiQuotaAdminData() });
  const [workspaceId, setWorkspaceId] = useState(fixedWorkspaceId ?? "");
  const [userId, setUserId] = useState(fixedUserId ?? "");
  const [provider, setProvider] = useState("weather");
  const [reason, setReason] = useState("");
  const selected = useMemo(() => query.data?.subjects.find((item: any) => item.workspaceId === workspaceId), [query.data, workspaceId]);
  useEffect(() => {
    if (fixedWorkspaceId) {
      setWorkspaceId(fixedWorkspaceId);
      if (!fixedUserId) setUserId("");
    } else if (!workspaceId && query.data?.subjects[0]) {
      setWorkspaceId(query.data.subjects[0].workspaceId);
    }
  }, [fixedWorkspaceId, fixedUserId, query.data, workspaceId]);
  useEffect(() => { if (fixedUserId) setUserId(fixedUserId); }, [fixedUserId]);
  const usage = useMemo(() => (query.data?.usage ?? []).filter((row: any) => row.workspace_uuid === workspaceId && (!userId || row.actor_user_id === userId)).reduce((totals: Record<string, number>, row: any) => ({ ...totals, [row.provider]: (totals[row.provider] ?? 0) + row.calls }), {}), [query.data, workspaceId, userId]);
  const reset = useMutation({
    mutationFn: () => resetExternalApiQuota({ data: { workspaceId, userId: userId || undefined, provider, reason } }),
    onSuccess: async (result: any) => { toast.success(text(`Quotum gereset (${result.deleted} regel(s)).`, `Quota reset (${result.deleted} row(s)).`)); setReason(""); await client.invalidateQueries({ queryKey: ["api-quota-admin"] }); },
    onError: () => toast.error(text("Quotum kon niet worden gereset.", "Quota could not be reset.")),
  });
  const diagnose = useMutation({
    mutationFn: () => diagnoseBookingProvider(),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["api-quota-admin"] }); toast.success(text("Booking.com-diagnose afgerond.", "Booking.com diagnosis completed.")); },
    onError: () => toast.error(text("Booking.com-diagnose is mislukt.", "Booking.com diagnosis failed.")),
  });
  const bookingStatus = (status: string) => ({ unknown:text("Nog niet gecontroleerd","Not checked"),ok:text("Bereikbaar","Reachable"),no_results:text("Geen beschikbaarheid","No availability"),invalid_input:text("Verkeerde invoer","Invalid input"),auth:text("Configuratiefout","Configuration error"),quota:text("Quotum bereikt","Quota reached"),timeout:"Timeout",unavailable:text("Providerstoring","Provider outage") } as Record<string,string>)[status] ?? status;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="size-5" />{text("API-quota", "API quotas")}</CardTitle><CardDescription>{text("Bekijk het verbruik van vandaag. Iedere reset vereist een reden en wordt in het auditlog vastgelegd.", "Review today's usage. Every reset requires a reason and is recorded in the audit log.")}</CardDescription></CardHeader><CardContent className="space-y-5">
    {query.data?.booking && <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{text("Controleert de verbinding zonder prijzen of beschikbaarheid te verzinnen.","Checks connectivity without inventing prices or availability.")}</p><Button type="button" variant="outline" disabled={diagnose.isPending} onClick={()=>diagnose.mutate()}>{text("Bereikbaarheid testen","Test connectivity")}</Button></div><div className="grid gap-3 sm:grid-cols-2">{(["hotels","cars"] as const).map((kind)=>{const state=query.data.booking[kind];return <div key={kind} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">Booking.com · {kind==="hotels"?text("hotels","hotels"):text("huurauto's","rental cars")}</strong><span className={`rounded-full px-2 py-0.5 text-xs ${state.status==="ok"?"bg-emerald-500/10 text-emerald-700":state.status==="unknown"?"bg-muted text-muted-foreground":"bg-amber-500/10 text-amber-800"}`}>{state.configured?bookingStatus(state.status):text("Niet ingesteld","Not configured")}</span></div><p className="mt-2 text-xs text-muted-foreground">{state.lastAttemptAt?`${text("Laatste controle","Last check")}: ${new Intl.DateTimeFormat(undefined,{dateStyle:"short",timeStyle:"short"}).format(new Date(state.lastAttemptAt))}`:text("Nog niet gecontroleerd sinds deze serverstart.","Not checked since this server start.")}{state.used!=null?` · ${state.used}/${state.limit} ${text("gebruikt","used")}`:state.remaining!=null?` · ${state.remaining} ${text("resterend","remaining")}`:""}{state.lastErrorCode?` · ${text("Foutcode","Error code")}: ${state.lastErrorCode}`:""}</p></div>})}</div></div>}
    {!fixedWorkspaceId && <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2"><Label>{text("Agency / workspace", "Agency / workspace")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setUserId(""); }}>{query.data?.subjects.map((item: any) => <option value={item.workspaceId} key={item.workspaceId}>{item.workspaceName} ({item.plan})</option>)}</select></label><label className="space-y-2"><Label>{text("Gebruiker", "User")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">{text("Volledige Agency / workspace", "Entire Agency / workspace")}</option>{selected?.users.map((user: any) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label></div>}
    {fixedWorkspaceId && !fixedUserId && <label className="block max-w-md space-y-2"><Label>{text("Bereik", "Scope")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">{text("Volledige Agency", "Entire Agency")}</option>{selected?.users.map((user: any) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>}
    <div className="grid gap-3 sm:grid-cols-3">{query.data?.providers.map((key: string) => { const label = providerLabels[key] ?? [key, key]; return <button type="button" key={key} onClick={() => setProvider(key)} className={`rounded-xl border p-4 text-left transition-colors ${provider === key ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}><span className="text-sm font-medium">{text(label[0], label[1])}</span><strong className="mt-2 block text-2xl">{usage[key] ?? 0}</strong><span className="text-xs text-muted-foreground">{text("aanroepen vandaag", "calls today")}</span></button>; })}</div>
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]"><label className="space-y-2"><Label>Provider</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={provider} onChange={(event) => setProvider(event.target.value)}>{query.data?.providers.map((key: string) => { const label = providerLabels[key] ?? [key, key]; return <option value={key} key={key}>{text(label[0], label[1])}</option>; })}</select></label><label className="space-y-2"><Label>{text("Reden voor reset (verplicht)", "Reason for reset (required)")}</Label><Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={text("Minimaal 10 tekens", "At least 10 characters")} /></label></div>
    <Button variant="destructive" disabled={reset.isPending || !workspaceId || reason.trim().length < 10} onClick={() => { if (window.confirm(text("Dit wist het gebruikte quotum van vandaag voor deze selectie. Doorgaan?", "This clears today's used quota for this selection. Continue?"))) reset.mutate(); }}><RotateCcw className="size-4" />{userId ? text("Quotum van gebruiker resetten", "Reset user quota") : text("Quotum van Agency resetten", "Reset Agency quota")}</Button>
  </CardContent></Card>;
}
