import { ContentReportReview } from "@/components/ContentReportReview";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Inbox, Mail } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listContactMessages, updateContactMessage, updateContactRetention } from "@/lib/contact.functions";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/contact")({ component: ContactInbox });
const statuses = ["new", "reviewing", "answered", "closed"] as const;
type Status = typeof statuses[number];
const labels: Record<Status, [string, string]> = { new: ["Nieuw", "New"], reviewing: ["In behandeling", "Reviewing"], answered: ["Beantwoord", "Answered"], closed: ["Gesloten", "Closed"] };

function ContactInbox() {
  const { text, locale } = useLocale();
  const query = useQuery({ queryKey: ["contact-messages"], queryFn: listContactMessages });
  const [filter, setFilter] = useState<Status | "all">("new");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => { const needle = search.trim().toLowerCase(); return (query.data ?? []).filter((row: any) => (filter === "all" || row.status === filter) && (!needle || `${row.name} ${row.email} ${row.subject} ${row.message}`.toLowerCase().includes(needle))); }, [query.data, filter, search]);
  const active: any = (query.data ?? []).find((row: any) => row.id === selected) ?? rows[0];
  async function change(id: string, status: Status) { setBusy(true); try { await updateContactMessage({ data: { id, status } }); await query.refetch(); toast.success(text("Status bijgewerkt.", "Status updated.")); } catch { toast.error(text("Status kon niet worden bijgewerkt.", "Status could not be updated.")); } finally { setBusy(false); } }
  return <div className="space-y-4">
    <div><h2 className="font-display text-2xl font-semibold">{text("Contactberichten", "Contact messages")}</h2><p className="mt-1 text-sm text-muted-foreground">{text("Behandel berichten die via de publieke contactpagina zijn ontvangen.", "Handle messages received through the public contact page.")}</p></div>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_13rem]"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={text("Zoek op naam, e-mail of inhoud…", "Search by name, email or content…")}/><select className="h-10 rounded-md border bg-background px-3" value={filter} onChange={e => setFilter(e.target.value as Status | "all")}><option value="all">{text("Alle statussen", "All statuses")}</option>{statuses.map(status => <option key={status} value={status}>{text(...labels[status])}</option>)}</select></CardContent></Card>
    {query.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{text("Berichten laden…", "Loading messages…")}</CardContent></Card> : query.isError ? <Card><CardContent className="p-6 text-sm text-destructive">{text("De contactberichten konden niet worden geladen.", "Contact messages could not be loaded.")}</CardContent></Card> : !rows.length ? <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><Inbox className="size-5"/>{text("Geen berichten binnen dit filter.", "No messages in this filter.")}</CardContent></Card> : <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
      <Card><CardHeader><CardTitle className="text-base">{text("Inbox", "Inbox")} · {rows.length}</CardTitle></CardHeader><CardContent className="max-h-[38rem] space-y-2 overflow-y-auto">{rows.map((row: any) => <button key={row.id} onClick={() => setSelected(row.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${active?.id === row.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}><div className="flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{row.subject}</strong><Badge variant={row.status === "new" ? "default" : "outline"}>{text(...labels[row.status as Status])}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{row.name} · {row.email}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</p></button>)}</CardContent></Card>
      {active && <Card><CardHeader><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><CardTitle>{active.subject}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{active.name} · {active.email}</p></div><Button asChild variant="outline" size="sm"><Link to="/company-mail" search={{to:active.email,subject:`Re: ${active.subject}`}}><Mail className="size-4"/>{text("Beantwoorden via bedrijfsmail", "Reply using company mail")}<ExternalLink className="size-3"/></Link></Button></div></CardHeader><CardContent className="space-y-5"><p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">{active.message}</p><div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium" htmlFor="contact-status">{text("Status", "Status")}</label><select id="contact-status" disabled={busy} className="h-10 rounded-md border bg-background px-3" value={active.status} onChange={e => void change(active.id, e.target.value as Status)}>{statuses.map(status => <option key={status} value={status} disabled={Boolean(active.content_reports) && (status === "closed" || status === "answered")}>{text(...labels[status])}</option>)}</select><span className="text-xs text-muted-foreground">{text("Het antwoord wordt vanuit een gekoppelde GlobeTrotr-mailbox verzonden.", "The reply is sent from a linked GlobeTrotr mailbox.")}</span></div><ContentReportReview key={active.id} message={active} onUpdated={query.refetch} /><RetentionControls message={active} onUpdated={query.refetch} /></CardContent></Card>}
    </div>}
  </div>;
}

function RetentionControls({ message, onUpdated }: { message: any; onUpdated: () => Promise<unknown> }) {
  const { text, locale } = useLocale();
  const [reason, setReason] = useState(message.retention_hold_reason ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setReason(message.retention_hold_reason ?? ""), [message.id, message.retention_hold_reason]);
  async function save(hold: boolean) {
    if (!hold && !window.confirm(text("Bewaarpauze opheffen? Als dit dossier langer dan zes maanden gesloten is, wordt het bij de volgende opschoning verwijderd.", "Release retention hold? A case closed more than six months ago will be deleted during the next cleanup."))) return;
    setSaving(true);
    try {
      await updateContactRetention({ data: { id: message.id, hold, reason } });
      await onUpdated();
      toast.success(text("Bewaarpauze bijgewerkt.", "Retention hold updated."));
    } catch { toast.error(text("Bewaarpauze kon niet worden opgeslagen.", "Retention hold could not be saved.")); }
    finally { setSaving(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4">
    <h3 className="text-sm font-semibold">{text("Bewaren en verwijderen", "Retention and deletion")}</h3>
    <p className="text-xs leading-relaxed text-muted-foreground">{text("Contactdossiers worden zes maanden na afsluiten automatisch verwijderd. Open dossiers blijven staan. Een bewaarpauze is alleen bedoeld voor een noodzakelijk geschil of een wettelijke verplichting; beoordeel regelmatig of die reden nog geldt.", "Contact cases are automatically deleted six months after closure. Open cases are retained. A hold is only intended for a necessary dispute or legal obligation; review its continued necessity regularly.")}</p>
    {message.closed_at && <p className="text-xs">{text("Afgesloten op: ", "Closed on: ")}{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(message.closed_at))}</p>}
    {message.retention_hold && <Badge variant="outline">{text("Bewaarpauze actief", "Retention hold active")}</Badge>}
    <label className="block space-y-1 text-xs"><span>{text("Reden bewaarpauze (10–500 tekens)", "Retention hold reason (10–500 characters)")}</span><Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} /></label>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving || reason.trim().length < 10} onClick={() => void save(true)}>{message.retention_hold ? text("Reden bijwerken", "Update reason") : text("Bewaarpauze instellen", "Place retention hold")}</Button>{message.retention_hold && <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save(false)}>{text("Bewaarpauze opheffen", "Release retention hold")}</Button>}</div>
  </section>;
}
