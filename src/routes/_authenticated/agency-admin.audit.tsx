import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, History } from "lucide-react";
import { getAgencyAudit } from "@/lib/agency.functions";
import { useLocale } from "@/lib/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/agency-admin/audit")({ component: AgencyAuditPage });
const labels: Record<string, [string, string]> = {
  "client.create": ["Klant aangemaakt", "Client created"], "client.update": ["Klant bijgewerkt", "Client updated"], "client.archive": ["Klant gearchiveerd", "Client archived"], "client.restore": ["Klant hersteld", "Client restored"],
  "settings.update": ["Organisatie-instellingen bijgewerkt", "Organisation settings updated"], "trip_branding.update": ["Reishuisstijl bijgewerkt", "Trip branding updated"],
  "permissions.role.update": ["Standaardrol bijgewerkt", "Default role updated"], "permissions.member.update": ["Persoonlijke rechten bijgewerkt", "Personal permissions updated"],
  "invitation.create": ["Teamuitnodiging gemaakt", "Team invitation created"], "invitation.renew": ["Teamuitnodiging vernieuwd", "Team invitation renewed"], "invitation.revoke": ["Teamuitnodiging ingetrokken", "Team invitation revoked"],
  "invitation.accept": ["Teamuitnodiging geaccepteerd", "Team invitation accepted"], "invitation.decline": ["Teamuitnodiging geweigerd", "Team invitation declined"],
  "member.role": ["Teamrol gewijzigd", "Team role changed"], "member.suspend": ["Teamlid geblokkeerd", "Team member suspended"], "member.restore": ["Teamlid hersteld", "Team member restored"], "member.remove": ["Teamlid verwijderd", "Team member removed"],
};
function AgencyAuditPage() {
  const { text, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const query = useQuery({ queryKey: ["agency-audit"], queryFn: () => getAgencyAudit(), retry: false });
  const entries = (query.data ?? []).slice(0, expanded ? 100 : 20);
  return <div className="space-y-6"><header><h1 className="flex items-center gap-2 font-display text-3xl font-semibold"><History className="size-7 text-primary"/>{text("Agency-activiteit", "Agency activity")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Bekijk wie wat heeft gewijzigd, waar dit gebeurde en welke vastgelegde reden erbij hoort.", "Review who changed what, where it happened and any recorded reason.")}</p></header><Card className="surface"><CardHeader><CardTitle className="text-base">{text("Recente beheeractiviteit", "Recent administration activity")}</CardTitle></CardHeader><CardContent className="space-y-2">
    {query.isLoading && <p className="text-sm text-muted-foreground">{text("Activiteit laden…", "Loading activity…")}</p>}
    {query.isError && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{text("De auditlog kon niet worden geladen.", "The audit log could not be loaded.")}</p>}
    {entries.map((entry: any) => <article key={entry.id} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{text(...(labels[entry.action] ?? [entry.action, entry.action]))}</strong><Badge variant="outline">{targetLabel(entry.targetType, text)}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{entry.actorName || text("Onbekend account", "Unknown account")} · {shortTarget(entry.targetId)}</p></div><time className="text-xs text-muted-foreground sm:text-right">{new Intl.DateTimeFormat(locale === "en-GB" ? "en-GB" : "nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</time><Button size="sm" variant="ghost" onClick={() => setSelected(entry)}><Eye className="size-4"/>{text("Details", "Details")}</Button></article>)}
    {query.data && !query.data.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{text("Nog geen beheeractiviteit vastgelegd.", "No administration activity has been recorded yet.")}</p>}
    {(query.data?.length ?? 0) > 20 && <Button variant="outline" onClick={() => setExpanded((value) => !value)}>{expanded ? text("Minder tonen", "Show less") : text("Alle activiteit tonen", "Show all activity")}</Button>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{text("Auditdetails", "Audit details")}</DialogTitle></DialogHeader>{selected && <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]"><Detail label={text("Actie", "Action")} value={text(...(labels[selected.action] ?? [selected.action, selected.action]))}/><Detail label={text("Gebruiker", "User")} value={`${selected.actorName || text("Onbekend", "Unknown")} (${selected.actorEmail || selected.actorId || "—"})`}/><Detail label={text("Waar", "Target")} value={`${targetLabel(selected.targetType, text)} · ${selected.targetId || "—"}`}/><Detail label={text("Tijdstip", "Timestamp")} value={new Date(selected.createdAt).toLocaleString()}/>{Object.entries(selected.context ?? {}).map(([key, value]) => <Detail key={key} label={key === "reason" ? text("Reden", "Reason") : key} value={formatDetail(value)}/>)}</dl>}</DialogContent></Dialog>
  </CardContent></Card></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <><dt className="font-medium text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></>; }
function formatDetail(value: unknown) { return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "—"; }
function targetLabel(value: string, text: (nl: string, en: string) => string) { const map: Record<string, [string, string]> = { client: ["Klant", "Client"], client_form: ["Klantformulier", "Client form"], client_form_template: ["Formuliersjabloon", "Form template"], workspace: ["Workspace", "Workspace"], trip: ["Reis", "Trip"], role: ["Rol", "Role"], member: ["Teamlid", "Team member"], invitation: ["Uitnodiging", "Invitation"] }; return text(...(map[value] ?? [value || "Actie", value || "Action"])); }
function shortTarget(value: string) { return value ? value.length > 28 ? `${value.slice(0, 28)}…` : value : "—"; }