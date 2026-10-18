import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, RefreshCw, Send, Plus, Mail, Users, UserRound, ShieldCheck, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MailSignaturePreview } from "@/components/mail/MailSignaturePreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import {
  getCorporateBusinessData,
  deleteCorporateMailbox,
  getEmailDeliveryMode,
  getEmailDeliveryOverview,
  retryEmailDelivery,
  requestCorporateMailboxSync,
  retryCorporateMailboxProvisioning,
  saveCorporateMailbox,
  setCorporateMailboxMember,
  setEmailDeliveryMode,
} from "@/lib/corporate-business.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/mail")({ component: Page });
const blank = {
  id: "",
  address: "",
  displayName: "",
  mailboxType: "shared" as "shared" | "personal" | "automated",
  hostingMode: "external" as "external" | "self_hosted",
  ownerUserId: "",
  signatureText: "",
  inboundSecretRef: "",
  outboundSecretRef: "",
  active: true,
  imapHost: "mail.globetrotr.nl",
  imapPort: 993,
  imapSecure: true,
  imapUsername: "",
  imapPassword: "",
};

function Page() {
  const { text, locale } = useLocale(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["corporate-business"],
    queryFn: () => getCorporateBusinessData(),
    refetchInterval: 30000,
  });
  const delivery = useQuery({
    queryKey: ["email-delivery-overview"],
    queryFn: () => getEmailDeliveryOverview(),
    refetchInterval: 30000,
  });
  const deliveryMode = useQuery({
    queryKey: ["email-delivery-mode"],
    queryFn: () => getEmailDeliveryMode(),
  });
  const [f, setF] = useState(blank),
    [saving, setSaving] = useState(false),
    [hasStoredPassword, setHasStoredPassword] = useState(false),
    [retrying, setRetrying] = useState(""),
    [requestingSync, setRequestingSync] = useState(false),
    [retryingProvisioning,setRetryingProvisioning]=useState(false),
    [modeReason, setModeReason] = useState(""),
    [changingMode, setChangingMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; address: string } | null>(null);
  const [deleteAddress, setDeleteAddress] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mailboxTab, setMailboxTab] = useState("settings");
  const selectedMailbox = q.data?.mailboxes.find((item: any) => item.id === f.id);
  const deleteBlockedReason = !q.data?.canDeleteMailbox
    ? text("Alleen de actieve platformeigenaar kan mailboxen verwijderen.", "Only the active platform owner can delete mailboxes.")
    : selectedMailbox?.mailbox_type === "automated" || ["info@globetrotr.nl", "privacy@globetrotr.nl"].includes(selectedMailbox?.address)
      ? text("Deze platform- of reismailbox is beschermd tegen verwijderen.", "This platform or trip mailbox is protected from deletion.")
      : selectedMailbox?.hosting_mode !== "self_hosted"
        ? text("Dit postvak staat geregistreerd als extern. Definitief verwijderen vereist een geverifieerde Stalwart-koppeling; wijzig de hostinginstelling niet alleen om deze knop te activeren.", "This mailbox is registered as external. Permanent deletion requires a verified Stalwart link; do not change the hosting setting just to enable this button.")
        : !selectedMailbox?.mail_server_account_id
          ? text("De Stalwart-accountkoppeling ontbreekt. Verwijderen is beschikbaar nadat het postvak correct is aangemaakt en gekoppeld.", "The Stalwart account link is missing. Deletion is available after the mailbox is correctly provisioned and linked.")
          : selectedMailbox?.deletion && selectedMailbox.deletion.status !== "error"
            ? text("De verwijdering is al aangevraagd en wordt door de worker verwerkt.", "Deletion has already been requested and is being processed by the worker.")
            : null;
  const initialMailboxSelected = useRef(false);
  const pendingDeletionId = useRef<string | null>(null);
  useEffect(() => {
    if (!initialMailboxSelected.current && q.data) {
      initialMailboxSelected.current = true;
      if (q.data.mailboxes[0]) edit(q.data.mailboxes[0]);
    }
  }, [q.data]);
  useEffect(() => {
    if (selectedMailbox?.deletion) pendingDeletionId.current = selectedMailbox.id;
    if (f.id && pendingDeletionId.current === f.id && q.data && !q.data.mailboxes.some((item: any) => item.id === f.id)) {
      setF({ ...blank });
      setMailboxTab("settings");
      setHasStoredPassword(false);
      pendingDeletionId.current = null;
    }
  }, [q.data, f.id, selectedMailbox]);
  async function removeMailbox() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteCorporateMailbox({ data: { mailboxId: deleteTarget.id, address: deleteAddress, reason: deleteReason } });
      pendingDeletionId.current = deleteTarget.id;
      setDeleteTarget(null);
      toast.success(text("Verwijdering aangevraagd. De worker verwijdert de mailbox en alle mail.", "Deletion requested. The worker will delete the mailbox and all mail."));
      await qc.invalidateQueries({ queryKey: ["corporate-business"] });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        MAILBOX_BUSY: text("Er loopt nog synchronisatie, verzending, upload of onderhoud. Rond dit eerst af.", "Sync, delivery, uploads or maintenance are still pending. Finish these first."),
        MAILBOX_RETENTION_BLOCKED: text("Controleer eerst de bewaarstatus van de berichten. Mail met een bewaarplicht kan niet worden verwijderd.", "Review message retention first. Messages on hold cannot be deleted."),
        MAILBOX_PROTECTED: text("Deze mailbox wordt door het platform of een reis gebruikt en kan niet worden verwijderd.", "This mailbox is used by the platform or a trip and cannot be deleted."),
        MAILBOX_STORAGE_SHARED: text("De mailbox verwijst naar gedeelde bestanden. Verwijderen is geblokkeerd.", "The mailbox references shared files. Deletion is blocked."),
      };
      toast.error(messages[code] ?? text("Mailbox verwijderen mislukt. Vernieuw de pagina en controleer de status.", "Mailbox deletion failed. Refresh the page and check its status."));
    } finally { setDeleting(false); }
  }
  function edit(m: any) {
    setMailboxTab("settings");
    setHasStoredPassword(Boolean(m.credentials_updated_at));
    setF({
      id: m.id,
      address: m.address,
      displayName: m.display_name,
      mailboxType: m.mailbox_type,
      hostingMode: m.hosting_mode ?? "external",
      ownerUserId: m.owner_user_id ?? "",
      signatureText: m.signature_text ?? "",
      inboundSecretRef: m.inbound_secret_ref ?? "",
      outboundSecretRef: m.outbound_secret_ref ?? "",
      active: m.active,
      imapHost: m.imap_host ?? "mail.globetrotr.nl",
      imapPort: m.imap_port ?? 993,
      imapSecure: m.imap_secure !== false,
      imapUsername: m.imap_username ?? m.address,
      imapPassword: "",
    });
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    let result: { id: string };
    try {
      result = await saveCorporateMailbox({
        data: {
          address: f.address,
          displayName: f.displayName,
          mailboxType: f.mailboxType,
          hostingMode: f.hostingMode,
          signatureText: f.signatureText,
          inboundSecretRef: f.inboundSecretRef,
          outboundSecretRef: f.outboundSecretRef,
          active: f.active,
          imapHost: f.imapHost,
          imapPort: f.imapPort,
          imapSecure: f.imapSecure,
          imapUsername: f.imapUsername,
          imapPassword: f.imapPassword,
          ...(f.id ? { id: f.id } : {}),
          ...(f.ownerUserId ? { ownerUserId: f.ownerUserId } : {}),
        },
      });
    } catch (error) {
      const code = String(error);
      toast.error(code.includes("MAILBOX_CREDENTIALS_KEY_")
        ? text("Mailbox niet opgeslagen: stel dezelfde geldige mailboxsleutel in op Node-01 en Node-02.", "Mailbox not saved: configure the same valid mailbox key on Node-01 and Node-02.")
        : text("Mailbox kon niet worden opgeslagen. Controleer de serverlog voor de foutcode.", "Mailbox could not be saved. Check the server log for the error code."));
      setSaving(false);
      return;
    }
    setF((current) => ({ ...current, id: result.id, imapPassword: "" }));
    if (!f.id) setMailboxTab("settings");
    if (f.imapPassword.trim()) setHasStoredPassword(true);
    toast.success(text("Mailbox opgeslagen.", "Mailbox saved."));
    try {
      await qc.invalidateQueries({ queryKey: ["corporate-business"] });
    } catch {
      toast.error(text("Mailbox opgeslagen, maar de lijst kon niet worden vernieuwd.", "Mailbox saved, but the list could not be refreshed."));
    } finally {
      setSaving(false);
    }
  }
  async function permission(userId: string, value: any) {
    await setCorporateMailboxMember({ data: { mailboxId: f.id, userId, permission: value } });
    await qc.invalidateQueries({ queryKey: ["corporate-business"] });
  }
  async function requestSync() {
    if (!f.id) return;
    setRequestingSync(true);
    try {
      await requestCorporateMailboxSync({ data: { mailboxId: f.id } });
      await qc.invalidateQueries({ queryKey: ["corporate-business"] });
      toast.success(text("Synchronisatie aangevraagd voor de volgende worker-ronde.", "Sync requested for the next worker cycle."));
    } catch {
      toast.error(text("Synchronisatie is al aangevraagd of dit postvak is niet actief.", "Sync is already requested or this mailbox is inactive."));
    } finally {
      setRequestingSync(false);
    }
  }
  async function retryProvisioning(){if(!f.id)return;setRetryingProvisioning(true);try{await retryCorporateMailboxProvisioning({data:{mailboxId:f.id}});await qc.invalidateQueries({queryKey:["corporate-business"]});toast.success(text("Mailboxaanmaak staat opnieuw klaar.","Mailbox provisioning is queued again."))}catch{toast.error(text("Mailboxaanmaak kon niet opnieuw worden gestart.","Mailbox provisioning could not be retried."))}finally{setRetryingProvisioning(false)}}
  async function retry(id: string, source: "service" | "corporate") {
    setRetrying(id);
    try {
      await retryEmailDelivery({ data: { id, source } });
      await delivery.refetch();
      toast.success(
        text("Bericht staat opnieuw klaar voor verzending.", "Message queued for delivery again."),
      );
    } catch {
      toast.error(
        text(
          "Dit bericht kon niet opnieuw worden klaargezet.",
          "This message could not be queued again.",
        ),
      );
    } finally {
      setRetrying("");
    }
  }
  async function changeMode() {
    if (modeReason.trim().length < 10) {
      toast.error(
        text("Geef een reden van minimaal 10 tekens.", "Enter a reason of at least 10 characters."),
      );
      return;
    }
    const next = deliveryMode.data?.mode === "live" ? "test" : "live";
    const question =
      next === "live"
        ? text(
            "Livemodus activeren en alle vastgehouden berichten vrijgeven?",
            "Enable live mode and release all held messages?",
          )
        : text(
            "Nieuwe uitgaande servicemail direct pauzeren?",
            "Pause new outgoing service email immediately?",
          );
    if (!window.confirm(question)) return;
    setChangingMode(true);
    try {
      const result = await setEmailDeliveryMode({
        data: { mode: next, releaseHeld: next === "live", reason: modeReason.trim() },
      });
      setModeReason("");
      await Promise.all([deliveryMode.refetch(), delivery.refetch()]);
      toast.success(
        next === "live"
          ? text(
              `${result.released} berichten vrijgegeven.`,
              `${result.released} messages released.`,
            )
          : text("Uitgaande servicemail gepauzeerd.", "Outgoing service email paused."),
      );
    } catch {
      toast.error(
        text("Bezorgmodus kon niet worden aangepast.", "Delivery mode could not be changed."),
      );
    } finally {
      setChangingMode(false);
    }
  }
  return (
    <Tabs defaultValue="mailboxes" className="space-y-4">
      <TabsList className="h-auto flex-wrap gap-1">
        <TabsTrigger value="mailboxes">{text("Mailboxen", "Mailboxes")}</TabsTrigger>
        <TabsTrigger value="delivery" className="gap-2">
          {text("Uitgaande mail", "Outgoing mail")}
          {deliveryMode.data && <Badge variant={deliveryMode.data.mode === "live" ? "default" : "secondary"}>
            {deliveryMode.data.mode === "live" ? text("Live", "Live") : text("Gepauzeerd", "Paused")}
          </Badge>}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mailboxes">
      <Tabs value={mailboxTab} onValueChange={setMailboxTab} className="space-y-4">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{text("Mailboxbeheer", "Mailbox management")}</p>
            <h1 className="break-all font-display text-xl font-semibold">{f.id ? selectedMailbox?.address : text("Nieuwe mailbox", "New mailbox")}</h1>
          </div>
          {f.id && <Badge variant="outline" className="gap-1.5"><Mail className="size-3.5" />{mailboxTypeLabel(selectedMailbox?.mailbox_type, text)}</Badge>}
        </header>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="settings">{text("Instellingen", "Settings")}</TabsTrigger>
          <TabsTrigger value="activity" disabled={!f.id}>
            {text("Status en toegang", "Status and access")}
            {selectedMailbox?.sync_status === "error" && <Badge variant="destructive" className="ml-2">{text("Fout", "Error")}</Badge>}
          </TabsTrigger>
        </TabsList>
      <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-5">
        <Card className="overflow-hidden lg:sticky lg:top-6">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-5" />
              {text("Mailboxen", "Mailboxes")}
            </CardTitle>
            <Badge variant="secondary">{q.data?.mailboxes.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="max-h-[32rem] space-y-1 overflow-y-auto px-3 pb-3">
            {q.data?.mailboxes.map((m: any) => (
              <button
                key={m.id}
                onClick={() => edit(m)}
                aria-pressed={f.id === m.id}
                className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${f.id === m.id ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/50"}`}
              >
                <span className={`mt-0.5 rounded-md p-2 ${f.id === m.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {m.mailbox_type === "personal" ? <UserRound className="size-4" /> : <Users className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{m.address}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">{mailboxTypeLabel(m.mailbox_type, text)}</span>
                  <span className={`mt-1 block text-xs ${m.sync_status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{!m.active ? text("Inactief", "Inactive") : mailboxSyncLabel(m.sync_status, text)}</span>
                </span>
              </button>
            ))}
            <Button variant="ghost" className="w-full justify-start gap-2 border-t" onClick={() => { setF({ ...blank }); setMailboxTab("settings"); setHasStoredPassword(false); }}>
              <Plus className="size-4" />{text("Mailbox toevoegen", "Add mailbox")}
            </Button>
          </CardContent>
        </Card>
        <div className="min-w-0">
          <TabsContent key={f.id || "new"} value="settings" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{text("Mailboxgegevens", "Mailbox details")}</CardTitle>
              <p className="text-sm text-muted-foreground">{text("Stel de afzender en het gebruik van dit postvak in.", "Set the sender and purpose of this mailbox.")}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={text("E-mailadres", "Email address")}
                  value={f.address}
                  set={(v) => setF({ ...f, address: v })}
                />
                <Field
                  label={text("Naam", "Name")}
                  value={f.displayName}
                  set={(v) => setF({ ...f, displayName: v })}
                />
                <label className="space-y-2">
                  <Label>{text("Soort", "Type")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={f.mailboxType}
                    onChange={(e) => setF({ ...f, mailboxType: e.target.value as any })}
                  >
                    <option value="shared">{text("Gedeeld", "Shared")}</option>
                    <option value="personal">{text("Persoonlijk", "Personal")}</option>
                    <option value="automated">{text("Automatisch reisadres", "Automated trip address")}</option>
                  </select>
                </label>
                {f.mailboxType === "personal" && (
                  <label className="space-y-2">
                    <Label>{text("Eigenaar", "Owner")}</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={f.ownerUserId}
                      onChange={(e) => setF({ ...f, ownerUserId: e.target.value })}
                    >
                      <option value="">—</option>
                      {q.data?.people.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={f.hostingMode==="self_hosted"} onChange={e=>setF({...f,hostingMode:e.target.checked?"self_hosted":"external",imapHost:e.target.checked?"mail.globetrotr.nl":f.imapHost,imapUsername:e.target.checked?f.address:f.imapUsername})}/>
                  <span><strong className="block">{text("GlobeTrotr-mailserver", "GlobeTrotr mail server")}</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{text("Laat GlobeTrotr dit postvak automatisch aanmaken en beheren.", "Let GlobeTrotr create and manage this mailbox automatically.")}</span></span>
                </label>
              </div>
              <Accordion type="multiple" defaultValue={f.id ? [] : ["connection"]}>
                <AccordionItem value="signature" className="border-0">
                  <AccordionTrigger className="rounded-lg px-3 hover:bg-muted/40 hover:no-underline">{text("Handtekening", "Signature")}</AccordionTrigger>
                  <AccordionContent className="space-y-3">
              <label className="block space-y-2">
                <Label>{text("Handtekening voor dit postvak", "Signature for this mailbox")}</Label>
                <Textarea
                  rows={6}
                  maxLength={2000}
                  value={f.signatureText}
                  onChange={(e) => setF({ ...f, signatureText: e.target.value })}
                />
              </label>
              <p className="text-xs text-muted-foreground">{text("Deze handtekening verschijnt automatisch onder uitgaande mail. Wijzig haar hier; de inbox bevat alleen berichten en concepten.", "This signature is added automatically to outgoing mail. Edit it here; the inbox only contains messages and drafts.")}</p>
              <MailSignaturePreview signatureText={f.signatureText} displayName={f.displayName} address={f.address} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="connection" className="border-0">
                  <AccordionTrigger className="rounded-lg px-3 hover:bg-muted/40 hover:no-underline">{text("Verbinding en wachtwoord", "Connection and password")}</AccordionTrigger>
                  <AccordionContent>
              <div className="rounded-xl border p-4">
                <p className="mb-3 text-sm font-medium">
                  {text("Postvak uitlezen", "Read mailbox")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={text("IMAP-server", "IMAP server")}
                    value={f.imapHost}
                    disabled={f.hostingMode==="self_hosted"}
                    set={(v) => setF({ ...f, imapHost: v })}
                  />
                  <Field
                    label={text("IMAP-gebruiker", "IMAP username")}
                    value={f.imapUsername}
                    disabled={f.hostingMode==="self_hosted"}
                    set={(v) => setF({ ...f, imapUsername: v })}
                  />
                  <label className="space-y-2">
                    <Label>{text("Poort", "Port")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={f.imapPort}
                      onChange={(e) => setF({ ...f, imapPort: Number(e.target.value) })}
                    />
                  </label>
                  <Field
                    label={text("IMAP-wachtwoord of app-password", "IMAP password or app password")}
                    type="password"
                    value={f.imapPassword}
                    placeholder={hasStoredPassword ? "••••••••" : undefined}
                    set={(v) => setF({ ...f, imapPassword: v })}
                  />
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.imapSecure}
                    onChange={(e) => setF({ ...f, imapSecure: e.target.checked })}
                  />
                  {text("Versleutelde IMAP-verbinding", "Encrypted IMAP connection")}
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  {text(
                    hasStoredPassword
                      ? "•••••••• betekent dat een wachtwoord is opgeslagen. Laat dit veld leeg om het te behouden; typ een nieuw wachtwoord om het te vervangen."
                      : "Vul het IMAP-wachtwoord in om dit postvak te koppelen. Het wachtwoord wordt versleuteld opgeslagen.",
                    hasStoredPassword
                      ? "•••••••• means a password is stored. Leave this field empty to keep it, or enter a new password to replace it."
                      : "Enter the IMAP password to connect this mailbox. The password is stored encrypted.",
                  )}
                </p>
                {f.hostingMode === "self_hosted" && <p className="mt-2 text-xs text-muted-foreground">
                  {text("Voor een bestaand Stalwart-postvak kun je hier een app-password voor IMAP opslaan. Het hoofdwachtwoord blijft dan behouden. Maak het app-password eerst aan in het mailaccount en controleer daarna de synchronisatie.", "For an existing Stalwart mailbox, you can save an IMAP app password here without changing the primary password. Create the app password in the mail account first, then check synchronization.")}
                </p>}
              </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button disabled={saving || deleting || Boolean(selectedMailbox?.deletion) || !f.address || !f.displayName} onClick={() => void save()}>
                {saving ? text("Opslaan…", "Saving…") : text("Wijzigingen opslaan", "Save changes")}
              </Button>
              </div>
              {selectedMailbox?.deletion && <div className="rounded-lg border p-3 text-sm" role="status">
                <p>{selectedMailbox.deletion.status === "error"
                  ? text("Verwijdering mislukt. De mailbox blijft geblokkeerd; je kunt opnieuw proberen.", "Deletion failed. The mailbox remains blocked; you can retry.")
                  : text("Mailbox en mail worden definitief verwijderd…", "Mailbox and mail are being permanently deleted…")}</p>
                {selectedMailbox.deletion.error_code && <p className="text-muted-foreground">{selectedMailbox.deletion.error_code}</p>}
              </div>}
              {selectedMailbox && <details className="pt-2">
                <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-destructive"><Trash2 className="size-4" />{text("Mailbox verwijderen", "Delete mailbox")}</summary>
                <div className="mt-4 space-y-3 rounded-lg bg-destructive/5 p-4">
                <p className="text-sm text-muted-foreground">{text("Verwijder dit postvak en de bijbehorende mail definitief. Het gebruikersaccount blijft behouden.", "Permanently delete this mailbox and its messages. The user account is retained.")}</p>
                <Button
                  variant="destructive" disabled={Boolean(deleteBlockedReason) || saving || deleting || requestingSync || retryingProvisioning}
                  onClick={() => { setDeleteTarget({ id: selectedMailbox.id, address: selectedMailbox.address }); setDeleteAddress(""); setDeleteReason(""); }}>
                  {selectedMailbox.deletion?.status === "error" ? text("Verwijdering opnieuw proberen", "Retry deletion") : text("Mailbox definitief verwijderen", "Permanently delete mailbox")}
                </Button>
                {deleteBlockedReason && <p className="text-sm text-muted-foreground">{deleteBlockedReason}</p>}
                </div>
              </details>}
              <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>{text("Mailbox definitief verwijderen?", "Permanently delete mailbox?")}</AlertDialogTitle>
                    <AlertDialogDescription>{text("Dit verwijdert de mailbox, alle mail en bijlagen uit Stalwart en GlobeTrotr. Dit kan niet ongedaan worden gemaakt. Het gebruikersaccount en de auditgeschiedenis blijven behouden.", "This deletes the mailbox, all mail and attachments from Stalwart and GlobeTrotr. This cannot be undone. The user account and audit history are retained.")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <Label htmlFor="delete-mailbox-address">{text("Typ het volledige mailadres", "Type the full email address")}: {deleteTarget?.address}</Label>
                  <Input id="delete-mailbox-address" value={deleteAddress} disabled={deleting} onChange={(event) => setDeleteAddress(event.target.value)} autoComplete="off" />
                  <Label htmlFor="delete-mailbox-reason">{text("Reden voor verwijderen", "Reason for deletion")}</Label>
                  <Textarea id="delete-mailbox-reason" value={deleteReason} disabled={deleting} maxLength={500} onChange={(event) => setDeleteReason(event.target.value)} />
                  <AlertDialogFooter><AlertDialogCancel disabled={deleting}>{text("Annuleren", "Cancel")}</AlertDialogCancel>
                    <Button variant="destructive" disabled={deleting || deleteAddress.trim() !== deleteTarget?.address || deleteReason.trim().length < 5} onClick={() => void removeMailbox()}>
                      {deleting ? text("Verwijdering aanvragen…", "Requesting deletion…") : text("Definitief verwijderen", "Permanently delete")}
                    </Button></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
          </TabsContent>
          <TabsContent value="activity" className="mt-0 space-y-4">
          {f.id && (() => {
            const mailbox = q.data?.mailboxes.find((item: any) => item.id === f.id);
            if (!mailbox) return null;
            return <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="size-4 text-muted-foreground" />{text("Mailboxstatus", "Mailbox status")}</CardTitle>
                <p className="text-sm text-muted-foreground">{text("Bekijk de verbinding en het ophalen van nieuwe berichten.", "Check the connection and retrieval of new messages.")}</p>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Server className="size-4" />{text("Mailserver", "Mail server")}</p>
                    <p className="font-medium">{mailbox.hosting_mode === "self_hosted" ? text("GlobeTrotr", "GlobeTrotr") : text("Externe mailserver", "External mail server")}</p>
                    <Badge variant={mailbox.provisioning_status === "error" ? "destructive" : "secondary"}>{provisioningLabel(mailbox.provisioning_status, text)}</Badge>
                  </div>
                  <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Inbox className="size-4" />{text("Berichten ophalen", "Message retrieval")}</p>
                    <p className="font-medium">{text("Mailboxsynchronisatie", "Mailbox synchronisation")}</p>
                    <Badge variant={mailbox.sync_status === "error" ? "destructive" : "secondary"}>{mailboxSyncLabel(mailbox.sync_status, text)}</Badge>
                  </div>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{text("Laatst gesynchroniseerd", "Last synchronised")}</dt><dd className="mt-1 font-medium">{formatSyncTime(mailbox.last_synced_at, locale, text)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{text("Laatste poging", "Last attempt")}</dt><dd className="mt-1 font-medium">{formatSyncTime(mailbox.last_sync_attempt_at, locale, text)}</dd></div>
                </dl>
                {mailbox.provisioning_error_code && <p className="break-all rounded-lg bg-destructive/5 p-3 text-destructive"><span className="font-medium">{text("Mailserver vraagt aandacht", "Mail server needs attention")}</span><code className="mt-1 block text-xs">{mailbox.provisioning_error_code}</code></p>}
                {mailbox.last_sync_error_code && <div className="rounded-lg bg-destructive/5 p-3 text-destructive"><p className="text-sm">{mailboxErrorHint(mailbox.last_sync_error_code, text)}</p><code className="mt-1 block break-all text-xs">{mailbox.last_sync_error_code}</code></div>}
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button variant="outline" disabled={requestingSync || !mailbox.active || Boolean(mailbox.sync_requested_at) || mailbox.sync_status === "syncing"} onClick={() => void requestSync()}>
                    <RefreshCw className={`size-4 ${requestingSync ? "animate-spin" : ""}`} />{requestingSync ? text("Aanvragen...", "Requesting...") : text("Opnieuw synchroniseren", "Synchronise again")}
                  </Button>
                  {mailbox.hosting_mode === "self_hosted" && mailbox.provisioning_status === "error" && <Button size="sm" variant="outline" disabled={retryingProvisioning} onClick={() => void retryProvisioning()}><RefreshCw className={`size-4 ${retryingProvisioning ? "animate-spin" : ""}`} />{text("Mailserver opnieuw verbinden", "Retry mail server setup")}</Button>}
                  {mailbox.sync_requested_at && <span role="status" className="text-xs text-muted-foreground">{text("Synchronisatie ingepland", "Synchronisation queued")}</span>}
                </div>
              </CardContent>
            </Card>;
          })()}
          {f.id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-muted-foreground" />{text("Toegang tot dit postvak", "Access to this mailbox")}</CardTitle>
                <p className="text-sm text-muted-foreground">{text("Bepaal wie berichten mag lezen, beantwoorden of beheren.", "Choose who can read, reply to or manage messages.")}</p>
              </CardHeader>
              <CardContent className="max-h-80 space-y-2 overflow-y-auto">
                {q.data?.people.map((p: any) => {
                  const isOwner = selectedMailbox?.owner_user_id === p.id;
                  const value = isOwner ? "manage" :
                    (q.data.mailboxMembers ?? []).find(
                      (m: any) => m.mailbox_id === f.id && m.user_id === p.id,
                    )?.permission ?? "none";
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 p-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{String(p.name || "?").slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block break-words font-medium">{p.name}</span>{isOwner && <span className="block text-xs text-muted-foreground">{text("Eigenaar · volledige toegang", "Owner · full access")}</span>}</span></span>
                      <select
                        aria-label={text(`Toegang voor ${p.name}`, `Access for ${p.name}`)}
                        disabled={isOwner}
                        className="h-9 min-w-32 rounded-md border bg-background px-3 disabled:opacity-60"
                        value={value}
                        onChange={(e) => void permission(p.id, e.target.value)}
                      >
                        <option value="none">{text("Geen", "None")}</option>
                        <option value="read">{text("Lezen", "Read")}</option>
                        <option value="reply">{text("Antwoorden", "Reply")}</option>
                        <option value="manage">{text("Beheren", "Manage")}</option>
                      </select>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          </TabsContent>
        </div>
      </div>
      </Tabs>
      </TabsContent>
      <TabsContent value="delivery">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            {text("Bezorging van uitgaande mail", "Outgoing email delivery")}
            <Badge variant={deliveryMode.data?.mode === "live" ? "default" : "secondary"}>
              {deliveryMode.data?.mode === "live"
                ? text("Live", "Live")
                : text("Gepauzeerd", "Paused")}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {text(
              "De laatste 100 service- en bedrijfsmails. Het overzicht ververst iedere 30 seconden.",
              "The latest 100 service and company emails. This overview refreshes every 30 seconds.",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-2">
              <Label>{text("Reden voor wijziging", "Reason for change")}</Label>
              <Input
                maxLength={300}
                value={modeReason}
                onChange={(event) => setModeReason(event.target.value)}
                placeholder={text(
                  "Bijvoorbeeld: relay succesvol getest",
                  "For example: relay tested successfully",
                )}
              />
            </label>
            <Button
              variant={deliveryMode.data?.mode === "live" ? "destructive" : "default"}
              disabled={changingMode || deliveryMode.isLoading}
              onClick={() => void changeMode()}
            >
              {deliveryMode.data?.mode === "live"
                ? text("Verzending pauzeren", "Pause delivery")
                : text("Livemodus activeren", "Enable live mode")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(delivery.data?.counts ?? {}).map(([status, count]) => (
              <Badge key={status} variant={status === "failed" ? "destructive" : "secondary"}>
                {deliveryLabel(status, text)}: {String(count)}
              </Badge>
            ))}
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">{text("Ontvanger", "Recipient")}</th>
                  <th>{text("Soort", "Type")}</th>
                  <th>Status</th>
                  <th>{text("Pogingen", "Attempts")}</th>
                  <th>{text("Aangemaakt", "Created")}</th>
                  <th>
                    <span className="sr-only">{text("Actie", "Action")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {delivery.data?.messages.map((message: any) => (
                  <tr key={message.id} className="border-t">
                    <td className="max-w-64 truncate py-3">{message.recipient_email}</td>
                    <td>
                      <Badge variant="outline">
                        {message.source === "corporate"
                          ? text("Bedrijfsmail", "Company mail")
                          : text("Servicemail", "Service email")}
                      </Badge>
                      <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground" title={message.subject ?? message.template_key}>
                        {message.subject ?? message.template_key}
                      </p>
                    </td>
                    <td>
                      <Badge variant={message.status === "failed" ? "destructive" : "outline"}>
                        {deliveryLabel(message.status, text)}
                      </Badge>
                      {message.last_error_code && (
                        <p
                          className="mt-1 max-w-52 truncate text-xs text-destructive"
                          title={message.last_error_code}
                        >
                          {message.last_error_code}
                        </p>
                      )}
                    </td>
                    <td>{message.attempts}</td>
                    <td>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(message.created_at))}
                    </td>
                    <td className="text-right">
                      {message.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retrying === message.id}
                          onClick={() => void retry(message.id, message.source)}
                        >
                          <RefreshCw
                            className={`size-4 ${retrying === message.id ? "animate-spin" : ""}`}
                          />
                          {text("Opnieuw", "Retry")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {delivery.data && !delivery.data.messages.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {text(
                  "Er zijn nog geen uitgaande mails verwerkt.",
                  "No outgoing emails have been processed yet.",
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
  );
}
function mailboxTypeLabel(type: string, text: (nl: string, en: string) => string) {
  return type === "personal" ? text("Persoonlijk", "Personal") : type === "automated" ? text("Reisadres", "Trip address") : text("Gedeeld", "Shared");
}
function provisioningLabel(status: string, text: (nl: string, en: string) => string) {
  if (status === "ready") return text("Verbonden", "Connected");
  if (status === "error") return text("Controle nodig", "Needs attention");
  if (status === "disabled") return text("Uitgeschakeld", "Disabled");
  if (status === "external") return text("Extern beheerd", "Managed externally");
  return text("Wordt ingericht", "Setting up");
}
function mailboxSyncLabel(status: string, text: (nl: string, en: string) => string) {
  return ({ not_configured: text("Niet ingesteld", "Not configured"), ready: text("Gereed", "Ready"), syncing: text("Bezig", "Syncing"), error: text("Fout", "Error"), disabled: text("Uitgeschakeld", "Disabled") } as Record<string, string>)[status] ?? status;
}
function mailboxErrorHint(code: string, text: (nl: string, en: string) => string) {
  const hints: Record<string, [string, string]> = {
    IMAP_AUTH_FAILED: ["Controleer postvakadres en IMAP-wachtwoord.", "Check the mailbox address and IMAP password."],
    IMAP_TLS_FAILED: ["Controleer certificaat, servernaam en TLS-instellingen.", "Check the certificate, server name and TLS settings."],
    IMAP_TIMEOUT: ["De mailserver reageerde niet op tijd; controleer de verbinding.", "The mail server did not respond in time; check connectivity."],
    IMAP_UNREACHABLE: ["De mailserver is niet bereikbaar; controleer host en netwerk.", "The mail server is unreachable; check the host and network."],
    IMAP_STORAGE_ERROR: ["De opslag is tijdelijk niet beschikbaar; probeer later opnieuw.", "Storage is temporarily unavailable; try again later."],
    MALWARE_SCANNER_UNAVAILABLE: ["De bijlagenscanner is niet beschikbaar; herstel deze op Node-02.", "The attachment scanner is unavailable; restore it on Node-02."],
  };
  return text(...(hints[code] ?? ["Bekijk de privacyveilige IMAP-workerlog op Node-02.", "Check the privacy-safe IMAP worker log on Node-02."]));
}
function formatSyncTime(value: string | null, locale: string, text: (nl: string, en: string) => string) {
  if (!value) return text("Nog niet", "Not yet");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text("Onbekend", "Unknown") : new Intl.DateTimeFormat(locale === "en-GB" ? "en-GB" : "nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function deliveryLabel(status: string, text: (nl: string, en: string) => string) {
  return (
    (
      {
        held: text("Vastgehouden", "Held"),
        pending: text("In wachtrij", "Queued"),
        processing: text("Wordt verzonden", "Sending"),
        sent: text("Verzonden", "Sent"),
        failed: text("Mislukt", "Failed"),
        cancelled: text("Geannuleerd", "Cancelled"),
      } as Record<string, string>
    )[status] ?? status
  );
}
function Field({
  label,
  value,
  set,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
