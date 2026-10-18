import { translationDraftMessage } from "@/lib/translation-errors";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Flag, Plus, RotateCcw, Scale, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  getCorporateGovernance, saveFeatureFlag, saveIncident, saveMaintenance,
  savePrivacyRequest, setPrivacyRequestArchived,
} from "@/lib/corporate-governance.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TranslationDraftButtons, type TranslationDirection } from "@/components/TranslationDraftButtons";
import { createTranslationDraft } from "@/lib/translation.functions";

export const Route = createFileRoute("/_authenticated/corporate-admin/governance")({
  head: () => ({ meta: [{ title: "Governance — GlobeTrotr" }] }),
  component: Page,
});

function Page() {
  const { text } = useLocale();
  const q = useQuery({ queryKey: ["corporate-governance"], queryFn: getCorporateGovernance });
  const [reason, setReason] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>();
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<any>();

  async function flag(row: any, enabled: boolean) {
    try {
      await saveFeatureFlag({ data: { key: row.flag_key, enabled, audience: row.audience, reason } });
      setReason("");
      await q.refetch();
      toast.success(text("Functie-instelling bijgewerkt.", "Feature setting updated."));
    } catch {
      toast.error(text("Vul een reden van minimaal 10 tekens in.", "Enter a reason of at least 10 characters."));
    }
  }

  async function archiveRequest(row: any) {
    setArchiving(row.id);
    try {
      await setPrivacyRequestArchived({ data: { id: row.id, archived: !row.archived_at } });
      await q.refetch();
      toast.success(row.archived_at
        ? text("Privacyverzoek hersteld.", "Privacy request restored.")
        : text("Privacyverzoek gearchiveerd.", "Privacy request archived."));
    } catch {
      toast.error(text("Alleen afgeronde of afgewezen verzoeken kunnen worden gearchiveerd.", "Only completed or rejected requests can be archived."));
    } finally {
      setArchiving("");
    }
  }

  const requests = (q.data?.requests ?? []).filter((row: any) => Boolean(row.archived_at) === showArchived);
  return <div className="space-y-6">
    <header>
      <Badge variant="secondary">{text("Bedrijfscontrole", "Business control")}</Badge>
      <h1 className="mt-3 flex items-center gap-2 font-display text-3xl font-semibold">
        <Scale className="size-7 text-primary" />{text("Privacy en platformbeheer", "Privacy and platform management")}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {text("Beheer hier platformbrede beslissingen. Iedere wijziging wordt met de uitvoerder in de auditlog vastgelegd.",
          "Manage platform-wide decisions here. Every change is recorded with its actor in the audit log.")}
      </p>
    </header>
    <Tabs defaultValue="maintenance">
      <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
        <TabsTrigger value="maintenance">{text("Onderhoud", "Maintenance")}</TabsTrigger>
        <TabsTrigger value="privacy">Privacy</TabsTrigger>
        <TabsTrigger value="features">{text("Uitrol", "Rollout")}</TabsTrigger>
      </TabsList>
      <TabsContent value="maintenance">
        <MaintenanceCard data={q.data?.maintenance} done={() => q.refetch()} />
      </TabsContent>
      <TabsContent value="privacy">
        <ListCard
          title={text("Privacyverzoeken", "Privacy requests")}
          description={text("Behandel open verzoeken op deadline. Archiveer pas na afronding; het verzoek blijft bewaard en herstelbaar.",
            "Handle open requests by deadline. Archive only after completion; the request remains stored and restorable.")}
          action={<div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? text("Actieve verzoeken", "Active requests") : text("Archief", "Archive")}
            </Button>
            <Button onClick={() => { setEditingRequest(undefined); setPrivacyOpen(true); }}>
              <Plus className="size-4" />{text("Handmatig", "Manual")}
            </Button>
          </div>}
          empty={showArchived ? text("Geen gearchiveerde verzoeken.", "No archived requests.") : text("Geen actieve privacyverzoeken.", "No active privacy requests.")}
        >
          {requests.map((row: any) => <div key={row.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="break-all font-medium">{row.requester_email}</p>
              <p className="text-sm text-muted-foreground">{row.request_type} · {text("deadline", "due")} {new Date(row.due_at).toLocaleDateString()}</p>
              {row.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.notes}</p>}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Badge variant={row.status === "completed" ? "secondary" : "outline"}>{row.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => { setEditingRequest(row); setPrivacyOpen(true); }}>
                {text("Beheren", "Manage")}
              </Button>
              <Button size="sm" variant="outline" disabled={archiving === row.id || (!row.archived_at && !["completed", "rejected"].includes(row.status))}
                onClick={() => void archiveRequest(row)}>
                {row.archived_at ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
                {row.archived_at ? text("Herstellen", "Restore") : text("Archiveren", "Archive")}
              </Button>
            </div>
          </div>)}
        </ListCard>
        <PrivacyDialog open={privacyOpen} setOpen={setPrivacyOpen} initial={editingRequest} done={() => q.refetch()} />
      </TabsContent>
      <TabsContent value="incidents">
        <ListCard
          title={text("Interne incidentregistratie", "Internal incident register")}
          description={text("Registreer een intern incident en werk ernst, status en samenvatting bij. Publieke communicatie staat onder Meldingen.",
            "Record an internal incident and update its severity, status and summary. Public communication is under Notifications.")}
          action={<Button onClick={() => { setEditingIncident(undefined); setIncidentOpen(true); }}>
            <Plus className="size-4" />{text("Incident toevoegen", "Add incident")}
          </Button>}
          empty={text("Geen incidenten geregistreerd.", "No incidents recorded.")}
        >
          {q.data?.incidents.map((row: any) => <div key={row.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="min-w-0 flex-1 break-words">{row.title}</strong>
              <Badge variant={row.severity === "critical" ? "destructive" : "outline"}>{row.severity}</Badge>
              <Badge variant="secondary">{row.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => { setEditingIncident(row); setIncidentOpen(true); }}>
                {text("Bewerken", "Edit")}
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {text("Gestart", "Started")}: {new Date(row.started_at).toLocaleString()}
              {row.resolved_at && <> · {text("Opgelost", "Resolved")}: {new Date(row.resolved_at).toLocaleString()}</>}
            </p>
          </div>)}
        </ListCard>
        <IncidentDialog open={incidentOpen} setOpen={setIncidentOpen} initial={editingIncident} done={() => q.refetch()} />
      </TabsContent>
      <TabsContent value="features">
        <Card><CardHeader>
          <CardTitle className="flex items-center gap-2"><Flag className="size-5" />{text("Gecontroleerde uitrol", "Controlled rollout")}</CardTitle>
          <p className="text-sm text-muted-foreground">{text("Schakel functies alleen met een vastgelegde reden in of uit.", "Enable or disable features only with a recorded reason.")}</p>
        </CardHeader><CardContent className="space-y-3">
          <Input placeholder={text("Verplichte reden voor wijziging", "Required reason for change")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
          {q.data?.flags.map((row: any) => <div key={row.flag_key} className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div><p className="font-medium">{text(row.label_nl, row.label_en)}</p><p className="text-xs text-muted-foreground">{row.audience} · {row.flag_key}</p></div>
            <Switch checked={row.enabled} onCheckedChange={(enabled) => void flag(row, enabled)} />
          </div>)}
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}

function MaintenanceCard({ data, done }: { data: any; done: () => Promise<unknown> }) {
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const [f, setF] = useState({ active: false, reasonNl: "We voeren gepland onderhoud uit.", reasonEn: "We are carrying out scheduled maintenance.", startsAt: "", endsAt: "", progressPercent: 0, statusNl: "Onderhoud wordt voorbereid.", statusEn: "Maintenance is being prepared.", reason: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setF({ active: Boolean(data.active), reasonNl: data.reason_nl, reasonEn: data.reason_en, startsAt: local(data.starts_at), endsAt: local(data.ends_at), progressPercent: Number(data.progress_percent ?? 0), statusNl: data.status_nl ?? "Onderhoud wordt voorbereid.", statusEn: data.status_en ?? "Maintenance is being prepared.", reason: "" });
  }, [data]);
  async function translate(direction: TranslationDirection) {
    const source = direction === "nl-en" ? "nl" : "en";
    const target = direction === "nl-en" ? "en" : "nl";
    const value = direction === "nl-en" ? f.reasonNl : f.reasonEn;
    if (!value.trim()) return;
    setBusy(true);
    try {
      const result = await createTranslationDraft({ data: { text: value, source, target } });
      setF((current) => direction === "nl-en" ? { ...current, reasonEn: result.translated } : { ...current, reasonNl: result.translated });
      toast.success(text("Vertaalconcept gemaakt. Controleer de onderhoudstekst voor opslaan.", "Translation draft created. Review the maintenance text before saving."));
    } catch (error) {
      toast.error(translationDraftMessage(error, text));
    } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const result = await saveMaintenance({ data: { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null } });
      await queryClient.invalidateQueries({ queryKey: ["public-maintenance"] });
      await done();
      toast.success(result.announced
        ? text("Onderhoud gepubliceerd met popup, status en melding.", "Maintenance published with popup, status and notification.")
        : text("Onderhoudsstatus opgeslagen.", "Maintenance status saved."));
    } catch { toast.error(text("Onderhoudsstatus kon niet worden opgeslagen.", "Maintenance status could not be saved.")); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader>
    <CardTitle className="flex items-center gap-2"><Wrench className="size-5" />{text("Onderhoudspagina", "Maintenance page")}</CardTitle>
    <p className="text-sm text-muted-foreground">{text("Publiceer gepland onderhoud als popup, op de statuspagina en als account- en pushmelding. Op de begintijd verschijnt de onderhoudspagina met reden en aftelling; Corporate Admin kan doorwerken.", "Publish scheduled maintenance as a popup, on the status page and as an account and push notification. At the start time, the maintenance page shows the reason and countdown; Corporate Admin can continue working.")}</p>
  </CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
    <label className="flex items-center gap-3 rounded-xl border p-4 sm:col-span-2"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} /><span><strong className="block">{text("Onderhoud publiceren", "Publish maintenance")}</strong><span className="text-xs text-muted-foreground">{text("Met een toekomstige begintijd wordt dit eerst als aankondiging getoond.", "With a future start time, this is shown as an announcement first.")}</span></span></label>
    <Field label={text("Reden Nederlands", "Dutch reason")}><Textarea value={f.reasonNl} onChange={(event) => setF({ ...f, reasonNl: event.target.value })} /></Field>
    <Field label={text("Reden Engels", "English reason")}><Textarea value={f.reasonEn} onChange={(event) => setF({ ...f, reasonEn: event.target.value })} /></Field>
    <Field label={text("Begintijd", "Start time")}><Input type="datetime-local" value={f.startsAt} onChange={(event) => setF({ ...f, startsAt: event.target.value })} /></Field>
    <Field label={text("Verwachte eindtijd", "Expected end time")}><Input type="datetime-local" value={f.endsAt} onChange={(event) => setF({ ...f, endsAt: event.target.value })} /></Field>
    <Field label={text("Voortgang (0–100%)", "Progress (0–100%)")}><Input type="number" min={0} max={100} step={1} value={f.progressPercent} onChange={(event) => setF({ ...f, progressPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></Field>
    <div className="hidden sm:block" />
    <Field label={text("Actuele status Nederlands", "Current status in Dutch")}><Input maxLength={240} value={f.statusNl} onChange={(event) => setF({ ...f, statusNl: event.target.value })} /></Field>
    <Field label={text("Actuele status Engels", "Current status in English")}><Input maxLength={240} value={f.statusEn} onChange={(event) => setF({ ...f, statusEn: event.target.value })} /></Field>
    <div className="sm:col-span-2"><TranslationDraftButtons translating={busy} canTranslateNl={f.reasonNl.trim().length >= 2} canTranslateEn={f.reasonEn.trim().length >= 2} onTranslate={(direction) => void translate(direction)} /></div>
    <label className="space-y-1 text-sm sm:col-span-2">{text("Interne reden voor auditlog", "Internal audit reason")}<Input value={f.reason} onChange={(event) => setF({ ...f, reason: event.target.value })} /></label>
    <Button className="sm:col-span-2 sm:justify-self-start" disabled={busy || f.reason.trim().length < 10} onClick={() => void save()}>{text("Onderhoudsstatus opslaan", "Save maintenance status")}</Button>
  </CardContent></Card>;
}

function ListCard(props: { title: string; description: string; action: React.ReactNode; empty: string; children: React.ReactNode }) {
  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3">
    <div><CardTitle>{props.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{props.description}</p></div>
    {props.action}
  </div></CardHeader><CardContent className="space-y-2">{Array.isArray(props.children) && props.children.length === 0
    ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{props.empty}</p>
    : props.children}</CardContent></Card>;
}

function PrivacyDialog({ open, setOpen, initial, done }: { open: boolean; setOpen: (value: boolean) => void; initial?: any; done: () => Promise<unknown> }) {
  const { text } = useLocale();
  const [f, setF] = useState({ id: undefined as string | undefined, email: "", type: "access", status: "received", notes: "", response: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ id: initial?.id, email: initial?.requester_email ?? "", type: initial?.request_type ?? "access", status: initial?.status ?? "received", notes: initial?.notes ?? "", response: initial?.response_text ?? "" });
  }, [open, initial]);
  async function submit() {
    setBusy(true);
    try {
      const { id, ...data } = f;
      await savePrivacyRequest({ data: { ...data, ...(id ? { id } : {}) } });
      setOpen(false);
      await done();
      toast.success(text("Privacyverzoek bijgewerkt.", "Privacy request updated."));
    } catch { toast.error(text("Opslaan mislukt.", "Save failed.")); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent>
    <DialogHeader><DialogTitle>{initial ? text("Privacyverzoek behandelen", "Handle privacy request") : text("Privacyverzoek registreren", "Register privacy request")}</DialogTitle></DialogHeader>
    <Input type="email" placeholder={text("E-mailadres", "Email address")} value={f.email} onChange={(event) => setF({ ...f, email: event.target.value })} />
    <select className="h-10 rounded-md border bg-background px-3" value={f.type} onChange={(event) => setF({ ...f, type: event.target.value })}>
      {["access", "correction", "deletion", "restriction", "objection", "portability", "other"].map((value) => <option key={value}>{value}</option>)}
    </select>
    <select className="h-10 rounded-md border bg-background px-3" value={f.status} onChange={(event) => setF({ ...f, status: event.target.value })}>
      {["received", "verifying", "processing", "completed", "rejected"].map((value) => <option key={value}>{value}</option>)}
    </select>
    <Textarea placeholder={text("Interne notities", "Internal notes")} value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} />
    <Textarea placeholder={text("Antwoord voor de gebruiker", "Response for the user")} value={f.response} onChange={(event) => setF({ ...f, response: event.target.value })} />
    {initial?.user_id && <Button asChild variant="outline"><a href={`/corporate-admin/user/${initial.user_id}`}>{text("Gebruiker openen", "Open user")}</a></Button>}
    <Button disabled={busy || !f.email.includes("@") || (f.status === "completed" && !f.response.trim())} onClick={() => void submit()}>{busy ? text("Opslaan…", "Saving…") : text("Opslaan", "Save")}</Button>
  </DialogContent></Dialog>;
}

function IncidentDialog({ open, setOpen, initial, done }: { open: boolean; setOpen: (value: boolean) => void; initial?: any; done: () => Promise<unknown> }) {
  const { text } = useLocale();
  const [f, setF] = useState({ id: undefined as string | undefined, title: "", severity: "medium", status: "investigating", summary: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ id: initial?.id, title: initial?.title ?? "", severity: initial?.severity ?? "medium", status: initial?.status ?? "investigating", summary: initial?.summary ?? "" });
  }, [open, initial]);
  async function submit() {
    setBusy(true);
    try {
      await saveIncident({ data: f });
      setOpen(false);
      await done();
      toast.success(initial ? text("Incident bijgewerkt.", "Incident updated.") : text("Incident geregistreerd.", "Incident registered."));
    } catch { toast.error(text("Incident kon niet worden opgeslagen.", "Incident could not be saved.")); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent>
    <DialogHeader><DialogTitle>{initial ? text("Incident bewerken", "Edit incident") : text("Incident registreren", "Register incident")}</DialogTitle></DialogHeader>
    <Field label={text("Titel", "Title")}><Input maxLength={160} value={f.title} onChange={(event) => setF({ ...f, title: event.target.value })} /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={text("Ernst", "Severity")}><select className="h-10 w-full rounded-md border bg-background px-3" value={f.severity} onChange={(event) => setF({ ...f, severity: event.target.value })}>
        {["low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{value}</option>)}
      </select></Field>
      <Field label={text("Status", "Status")}><select className="h-10 w-full rounded-md border bg-background px-3" value={f.status} onChange={(event) => setF({ ...f, status: event.target.value })}>
        {["investigating", "identified", "monitoring", "resolved"].map((value) => <option key={value} value={value}>{value}</option>)}
      </select></Field>
    </div>
    <Field label={text("Samenvatting en herstel", "Summary and recovery")}><Textarea rows={5} maxLength={3000} value={f.summary} onChange={(event) => setF({ ...f, summary: event.target.value })} /></Field>
    <Button disabled={busy || f.title.trim().length < 3 || f.summary.trim().length < 10} onClick={() => void submit()}>{busy ? text("Opslaan…", "Saving…") : text("Opslaan", "Save")}</Button>
  </DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-sm">{label}{children}</label>;
}
function local(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
