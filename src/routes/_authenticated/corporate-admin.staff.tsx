import { getCorporateStaffActivity } from "@/lib/corporate-business.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getCorporateStaff,
  inviteCorporateStaff,
  saveCorporateStaff,
  removeCorporateStaff,
  retryCorporateStaffIdentity,
  suggestCorporateMailbox,
} from "@/lib/corporate-business.functions";
import { useLocale } from "@/lib/locale";
export const Route = createFileRoute("/_authenticated/corporate-admin/staff")({ component: Page });
const keys = ["users", "agencies", "finance", "mail", "operations", "issues"];
function Page() {
  const { text } = useLocale(),
    q = useQuery({
      queryKey: ["corporate-staff"],
      queryFn: () => getCorporateStaff(),
      refetchInterval: 10000,
    }),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [form, setForm] = useState<any>(),
    [invite, setInvite] = useState({ name: "", email: "" }),
    [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [requestingIdentity, setRequestingIdentity] = useState(false);
  const [onboarding, setOnboarding] = useState({
    role: "support" as "owner" | "admin" | "support",
    permissions: { mail: true, issues: true } as Record<string, boolean>,
    mailboxAddress: "",
    jobTitle: "",
    reason: "",
  });
  const permissionLabels: Record<string, string> = {
    users: text("Gebruikers", "Users"), agencies: text("Reisbureaus", "Agencies"),
    finance: text("Financiën", "Finance"), mail: text("Bedrijfsmail", "Company mail"),
    operations: text("Bedrijfsbeheer", "Operations"), issues: text("Supportmeldingen", "Support issues"),
  };
  async function requestIdentity(inviteAgain: boolean) {
    if (!form) return;
    setRequestingIdentity(true);
    try {
      await retryCorporateStaffIdentity({ data: { userId: form.userId, invite: inviteAgain } });
      await q.refetch();
      toast.success(text("Inrichting aangevraagd.", "Provisioning requested."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "STAFF_REQUEST_FAILED");
    } finally {
      setRequestingIdentity(false);
    }
  }
  async function remove() {
    if (
      !form ||
      !window.confirm(
        text(
          "Deze medewerker definitief uit het staffteam verwijderen? Het persoonlijke postvak en de inhoud worden verwijderd, daarna de door GBT beheerde Authentik-identiteit. Het gewone GBT-account, reizen, gedeelde postvakken en audit blijven behouden. Bewaar eventueel benodigde mail voordat je doorgaat.",
          "Permanently remove this staff member? Their personal mailbox and its contents will be deleted, followed by the GBT-managed Authentik identity. Their ordinary GBT account, trips, shared mailboxes and audit remain. Save any needed mail before proceeding.",
        ),
      )
    )
      return;
    setRemoving(true);
    try {
      const result = await removeCorporateStaff({ data: { userId: form.userId, reason, confirmation: "DELETE_STAFF_ACCOUNT" } });
      if (result.queued) setForm((current: any) => ({ ...current, removalQueued: true }));
      else { setSelected(""); setForm(undefined); setReason(""); }
      await q.refetch();
      toast.success(
        text(
          result.queued ? "Verwijdering aangevraagd. Het postvak en de teamidentiteit worden opgeruimd; volg de status hieronder." : "Uit het staffteam verwijderd. Het gewone account blijft behouden.",
          result.queued ? "Removal requested. The mailbox and team identity are being cleaned up; follow the status below." : "Removed from staff. The ordinary account is preserved.",
        ),
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      if (code === "STAFF_REMOVE_CONFIRMATION_REQUIRED") {
        toast.error(text("De verwijderbevestiging ontbreekt.", "The removal confirmation is missing."), {
          description: text("Er is geen verwijdering gestart. Herlaad de pagina en bevestig opnieuw dat het persoonlijke postvak en de mailinhoud definitief worden verwijderd.", "No removal was started. Reload the page and confirm again that the personal mailbox and its contents will be permanently deleted."),
          action: { label: text("Pagina herladen", "Reload page"), onClick: () => window.location.reload() },
        });
      } else toast.error(
        text("Verwijderen mislukt: ", "Removal failed: ") +
          code,
      );
      await q.refetch();
    } finally {
      setRemoving(false);
    }
  }
  async function choose(userId: string, source = q.data) {
    setSelected(userId);
    const existing = source?.staff.find((x: any) => x.user_id === userId);
    if (existing) {
      setForm({
        userId,
        role: existing.role,
        jobTitle: existing.job_title ?? "",
        active: existing.active,
        permissions: existing.permissions ?? {},
        mailboxAddress: existing.mailbox?.address ?? "",
        cleanupOnly: existing.cleanupOnly === true,
      });
      return;
    }
    const person = source?.candidates.find((x: any) => x.id === userId),
      suggestion = await suggestCorporateMailbox({ data: { name: person?.name ?? "" } });
    setForm({
      userId,
      role: "support",
      jobTitle: "",
      active: true,
      permissions: { mail: true, issues: true },
      mailboxAddress: suggestion.address,
    });
  }
  async function save() {
    const risky = !form.active || form.role === "owner";
    if (
      risky &&
      !window.confirm(
        text(
          "Dit wijzigt kritieke bedrijfsrechten. Weet je zeker dat je wilt doorgaan?",
          "This changes critical company permissions. Are you sure you want to continue?",
        ),
      )
    )
      return;
    try {
      const result = await saveCorporateStaff({ data: { ...form, reason } });
      await q.refetch();
      setReason("");
      toast.success(
        text(
          result.automationQueued
            ? "Medewerker opgeslagen. Accountinrichting en uitnodiging staan klaar voor verwerking."
            : "Medewerker bijgewerkt. Laat deze persoon opnieuw inloggen.",
          result.automationQueued
            ? "Staff member saved. Account provisioning and invitation are queued."
            : "Staff member updated. Ask this person to sign in again.",
        ),
      );
    } catch (e: any) {
      toast.error(
        e?.message === "LAST_OWNER"
          ? text(
              "De laatste eigenaar kan niet worden verwijderd.",
              "The last owner cannot be removed.",
            )
          : e?.message === "STAFF_MAILBOX_IN_USE"
            ? text(
                "Dit mailadres is al aan een ander postvak gekoppeld.",
                "This address belongs to another mailbox.",
              )
            : e?.message === "INVALID_STAFF"
              ? text(
                  "Controleer het mailadres, de functie en de reden.",
                  "Check the email address, job title and reason.",
                )
              : text(
                  `Medewerker kon niet worden bijgewerkt (${e?.message || "ONBEKEND"}).`,
                  `Staff member could not be updated (${e?.message || "UNKNOWN"}).`,
                ),
      );
    }
  }
  async function invitePerson() {
    if (
      q.data?.automationEnabled &&
      onboarding.role === "owner" &&
      !window.confirm(
        text(
          "Deze nieuwe medewerker krijgt eigenaarsrechten. Doorgaan?",
          "This new staff member will receive owner permissions. Continue?",
        ),
      )
    )
      return;
    setInviting(true);
    try {
      const result = await inviteCorporateStaff({
        data: { ...invite, ...(q.data?.automationEnabled ? { provisioning: onboarding } : {}) },
      });
      const refreshed = await q.refetch();
      setInvite({ name: "", email: "" });
      await choose(result.userId, refreshed.data);
      setAddOpen(false);
      if (result.setupError) {
        toast.error(
          text(
            "Account aangemaakt; inrichting nog niet opgeslagen. Corrigeer de gegevens hieronder en sla opnieuw op.",
            "Account created; setup was not saved. Correct the details below and save again.",
          ),
        );
        return;
      }
      setOnboarding({
        role: "support",
        permissions: { mail: true, issues: true },
        mailboxAddress: "",
        jobTitle: "",
        reason: "",
      });
      toast.success(
        text(
          result.provisioningQueued
            ? "Medewerker, rechten, mailbox en uitnodiging staan klaar voor automatische inrichting."
            : result.invitationSent
              ? "Uitnodiging verstuurd. Stel nu de rol en mailbox in."
              : "Account voorbereid. Stel de rol en mailbox in en sla op om de Authentik-uitnodiging aan te vragen.",
          result.provisioningQueued
            ? "Staff member, permissions, mailbox and invitation are queued for automatic setup."
            : result.invitationSent
              ? "Invitation sent. Now configure the role and mailbox."
              : "Account prepared. Configure the role and mailbox, then save to request the Authentik invitation.",
        ),
      );
    } catch {
      toast.error(
        text("Medewerker kon niet worden uitgenodigd.", "Staff member could not be invited."),
      );
    } finally {
      setInviting(false);
    }
  }
  return (
    <Dialog open={addOpen} onOpenChange={(open) => { if (!inviting) setAddOpen(open); }}>
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">{text("Medewerkers", "Staff")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{text("Beheer je team, werkaccounts en toegang.", "Manage your team, work accounts and access.")}</p>
        </div>
        <DialogTrigger asChild><Button disabled={!q.data?.canManage}><Plus className="size-4" />{text("Medewerker toevoegen", "Add staff member")}</Button></DialogTrigger>
      </header>
      <DialogContent className="sm:max-w-2xl" onEscapeKeyDown={(event) => { if (inviting) event.preventDefault(); }} onInteractOutside={(event) => { if (inviting) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{text("Medewerker toevoegen", "Add staff member")}</DialogTitle>
          <DialogDescription>{text("Nodig iemand uit of selecteer een bestaand GBT-account om toegang tot je team in te stellen.", "Invite someone or select an existing GBT account to configure access to your team.")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1" role="group" aria-label={text("Manier van toevoegen", "How to add staff")}>
          {(["new", "existing"] as const).map((mode) => <button key={mode} type="button" aria-pressed={addMode === mode} disabled={inviting} onClick={() => setAddMode(mode)} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${addMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode === "new" ? text("Nieuwe medewerker", "New staff member") : text("Bestaand account", "Existing account")}</button>)}
        </div>
        {addMode === "existing" ? <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="add-staff-account">{text("GBT-account", "GBT account")}</Label>
            <select id="add-staff-account" className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value="" disabled={!q.data?.canManage} onChange={(event) => {
              if (!event.target.value) return;
              void choose(event.target.value).then(() => setAddOpen(false)).catch(() => toast.error(text("Het account kon niet worden geopend. Probeer opnieuw.", "The account could not be opened. Try again.")));
            }}>
              <option value="">{text("Selecteer een bestaand account", "Select an existing account")}</option>
              {q.data?.candidates.filter((candidate: any) => !q.data.staff.some((staff: any) => staff.user_id === candidate.id)).map((person: any) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
            </select>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{text("Na selectie kun je de rol, werkmailbox en rechten instellen. Toegang wordt pas toegewezen wanneer je de medewerker opslaat.", "After selecting an account, configure their role, work mailbox and permissions. Access is only assigned when you save the staff member.")}</p>
        </div> : <div className="space-y-6 py-2">
          <fieldset disabled={inviting} className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">{text("Contactgegevens", "Contact details")}</legend>
          <div className="space-y-2">
          <Label htmlFor="new-staff-name">{text("Volledige naam", "Full name")}</Label>
          <Input
            id="new-staff-name"
            placeholder={text("Volledige naam", "Full name")}
            maxLength={100}
            value={invite.name}
            onChange={(e) => setInvite({ ...invite, name: e.target.value })}
            onBlur={() => {
              if (q.data?.automationEnabled && !onboarding.mailboxAddress && invite.name.trim())
                void suggestCorporateMailbox({ data: { name: invite.name } })
                  .then((result) =>
                    setOnboarding((current) =>
                      current.mailboxAddress
                        ? current
                        : { ...current, mailboxAddress: result.address },
                    ),
                  )
                  .catch(() => {});
            }}
          />
          </div>
          <div className="space-y-2">
          <Label htmlFor="new-staff-email">{text("Contactadres", "Contact email")}</Label>
          <Input
            id="new-staff-email"
            type="email"
            placeholder="naam@example.com"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{text("Gebruik een bereikbaar adres voor de uitnodiging.", "Use a reachable email address for the invitation.")}</p>
          </div>
          </fieldset>
          {q.data?.automationEnabled && (
            <fieldset disabled={inviting} className="grid gap-5 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">{text("Werkaccount", "Work account")}</legend>
              <Label className="flex flex-col items-stretch gap-2">
                {text("Werkmailbox", "Work mailbox")}
                <Input
                  value={onboarding.mailboxAddress}
                  placeholder="v.achternaam@globetrotr.nl"
                  onChange={(e) => setOnboarding({ ...onboarding, mailboxAddress: e.target.value.toLowerCase().trim() })}
                />
              </Label>
              <Label className="flex flex-col items-stretch gap-2">
                {text("Rol", "Role")}
                <select className="h-10 w-full rounded-md border bg-background px-3" value={onboarding.role} onChange={(e) => setOnboarding({ ...onboarding, role: e.target.value as "owner" | "admin" | "support" })}>
                  <option value="support">Support</option><option value="admin">Admin</option><option value="owner">{text("Eigenaar", "Owner")}</option>
                </select>
              </Label>
              <Label className="flex flex-col items-stretch gap-2">{text("Functie", "Job title")}<Input maxLength={100} value={onboarding.jobTitle} onChange={(e) => setOnboarding({ ...onboarding, jobTitle: e.target.value })} /></Label>
              <Label className="flex flex-col items-stretch gap-2">{text("Reden voor inrichting", "Reason for setup")}<Input maxLength={500} placeholder={text("Minimaal 10 tekens", "At least 10 characters")} value={onboarding.reason} onChange={(e) => setOnboarding({ ...onboarding, reason: e.target.value })} /></Label>
            </fieldset>
          )}
          {q.data?.automationEnabled && <fieldset disabled={inviting}>
            <legend className="mb-3 text-sm font-semibold">{text("Toegang en rechten", "Access and permissions")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {keys.map((key) => <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${onboarding.role === "owner" || onboarding.permissions[key] ? "border-primary/25 bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"}`}>
                <input type="checkbox" className="size-4 shrink-0 accent-primary" disabled={onboarding.role === "owner"} checked={onboarding.role === "owner" || onboarding.permissions[key] === true} onChange={(e) => setOnboarding({ ...onboarding, permissions: { ...onboarding.permissions, [key]: e.target.checked } })} />
                {permissionLabels[key]}
              </label>)}
            </div>
          </fieldset>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="ghost" disabled={inviting} onClick={() => setAddOpen(false)}>{text("Annuleren", "Cancel")}</Button>
          <Button
            disabled={
              !q.data?.canManage ||
              inviting ||
              invite.name.trim().length < 2 ||
              !invite.email.includes("@") ||
              (q.data?.automationEnabled &&
                (onboarding.reason.trim().length < 10 ||
                  !onboarding.mailboxAddress.endsWith("@globetrotr.nl")))
            }
            onClick={() => void invitePerson()}
          >
            {inviting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {q.data?.automationEnabled
              ? text("Medewerker inrichten", "Set up staff member")
              : text("Uitnodigen", "Invite")}
          </Button>
          </div>
        </div>}
      </DialogContent>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2">
              <UserCog className="size-5" />
              {text("Bestaande medewerkers", "Existing staff")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.isLoading && <p role="status" className="py-2 text-sm text-muted-foreground">{text("Medewerkers laden…", "Loading staff…")}</p>}
            {q.isError && <p role="alert" className="py-2 text-sm text-destructive">{text("Medewerkers konden niet worden geladen.", "Staff could not be loaded.")}</p>}
            {q.isSuccess && !q.data?.staff.length && <p className="py-2 text-sm text-muted-foreground">{text("Nog geen medewerkers toegevoegd.", "No staff members added yet.")}</p>}
            {q.data?.staff.map((s: any) => (
              <button
                key={s.user_id}
                type="button"
                aria-pressed={selected === s.user_id}
                onClick={() => void choose(s.user_id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${selected === s.user_id ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <strong className="block truncate">{s.name || s.accountEmail}</strong>
                <span className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{s.cleanupOnly ? text("Eerder verwijderd", "Previously removed") : s.role}</Badge>
                  {s.identityProvisioning?.removal_requested_at && <Badge variant="outline">{text("Verwijdering", "Removal")}</Badge>}
                  {!s.active && <Badge variant="destructive">{text("Inactief", "Inactive")}</Badge>}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
        {form ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {q.data?.candidates.find((p: any) => p.id === form.userId)?.name ||
                  text("Medewerker", "Staff member")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(q.data?.automationEnabled || q.data?.staff.find((s: any) => s.user_id === form.userId)?.identityProvisioning?.removal_requested_at) && (
                <StaffProvisioningStatus
                  job={
                    q.data.staff.find((s: any) => s.user_id === form.userId)?.identityProvisioning
                  }
                  mailbox={q.data.staff.find((s: any) => s.user_id === form.userId)?.mailbox}
                  active={q.data.staff.find((s: any) => s.user_id === form.userId)?.active === true}
                  canManage={q.data.canManage && !q.data.staff.find((s: any) => s.user_id === form.userId)?.cleanupOnly}
                  busy={requestingIdentity}
                  onRequest={requestIdentity}
                />
              )}
              {form.removalQueued && !q.data?.staff.some((s: any) => s.user_id === form.userId) && (
                <p role="status">{text("Verwijdering afgerond. Het gewone GBT-account blijft behouden.", "Removal completed. The ordinary GBT account is preserved.")}</p>
              )}
              <fieldset disabled={form.cleanupOnly || form.removalQueued || !!q.data?.staff.find((s: any) => s.user_id === form.userId)?.identityProvisioning?.removal_requested_at} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <Label>{text("Rol", "Role")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <Label>{text("Functie", "Job title")}</Label>
                  <Input
                    maxLength={100}
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <Label>{text("Persoonlijke mailbox", "Personal mailbox")}</Label>
                  <Input
                    value={form.mailboxAddress}
                    onChange={(e) =>
                      setForm({ ...form, mailboxAddress: e.target.value.toLowerCase() })
                    }
                    placeholder="v.achternaam@globetrotr.nl"
                  />
                </label>
              </div>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 font-medium">
                  {text("Bedrijfsrechten", "Company permissions")}
                </legend>
                {keys.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.role === "owner" || Boolean(form.permissions[k])}
                      disabled={form.role === "owner"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          permissions: { ...form.permissions, [k]: e.target.checked },
                        })
                      }
                    />
                    {permissionLabels[k]}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                {text("Actieve medewerker", "Active staff member")}
              </label>
              </fieldset>
              <label className="block space-y-2">
                <Label>{text("Reden (verplicht)", "Reason (required)")}</Label>
                <Input
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={text("Minimaal 10 tekens", "At least 10 characters")}
                />
              </label>
              <Button
                disabled={!q.data?.canManage || reason.trim().length < 10 || removing || form.cleanupOnly || form.removalQueued || !!q.data?.staff.find((s: any) => s.user_id === form.userId)?.identityProvisioning?.removal_requested_at}
                onClick={() => void save()}
              >
                <Save className="size-4" />
                {text("Medewerker opslaan", "Save staff member")}
              </Button>
              <StaffActivity userId={selected} />
              {q.data?.staff.some((member: any) => member.user_id === form.userId) && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {text(
                      "Maak de medewerker eerst inactief en sla op. Definitief verwijderen ruimt het persoonlijke postvak en de beheerde Authentik-identiteit op. Bewaarpauses of lopende mailtaken blokkeren opruimen. Het gewone account en audit blijven behouden.",
                      "Deactivate and save first. Permanent removal cleans up the personal mailbox and managed Authentik identity. Retention holds or ongoing mail jobs block cleanup. The ordinary account and audit remain.",
                    )}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={
                      !q.data?.canManage ||
                      removing ||
                      reason.trim().length < 10 ||
                      (!!q.data.staff.find((member: any) => member.user_id === form.userId)?.identityProvisioning?.removal_requested_at &&
                        q.data.staff.find((member: any) => member.user_id === form.userId)?.identityProvisioning?.status !== "error") ||
                      q.data.staff.find((member: any) => member.user_id === form.userId)?.active !==
                        false
                    }
                    onClick={() => void remove()}
                  >
                    {text("Staffaccount en persoonlijk postvak verwijderen", "Delete staff account and personal mailbox")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="flex items-center justify-center bg-muted/10">
            <CardContent className="flex max-w-md flex-col items-center gap-3 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true"><UserCog className="size-6" /></div>
              <h2 className="font-display text-lg font-semibold">{text("Kies een medewerker", "Choose a staff member")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{text(
                "Selecteer een medewerker om het werkaccount en de toegang te beheren, of voeg een medewerker toe.",
                "Select a staff member to manage their work account and access, or add a staff member.",
              )}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </Dialog>
  );
}

function StaffProvisioningStatus({
  job,
  mailbox,
  active,
  canManage,
  busy,
  onRequest,
}: {
  job: any;
  mailbox: any;
  active: boolean;
  canManage: boolean;
  busy: boolean;
  onRequest: (invite: boolean) => Promise<void>;
}) {
  const { text } = useLocale();
  if (job?.removal_requested_at) return (
    <section className="space-y-2 rounded-lg border p-3 text-sm" role="status">
      <strong>{text("Definitieve verwijdering", "Permanent removal")}</strong>
      <p>{text("Het persoonlijke postvak wordt eerst verwijderd, daarna de beheerde SSO-identiteit. Het gewone GBT-account blijft behouden.", "The personal mailbox is deleted first, then the managed SSO identity. The ordinary GBT account is preserved.")}</p>
      <p>{job.status === "error" ? text("Verwijdering vereist controle; na herstel kun je opnieuw aanvragen.", "Removal needs review; retry after resolving the issue.") : text("Verwijdering wacht op verwerking of is bezig.", "Removal is queued or in progress.")}</p>
      {job.error_code && <p className="text-destructive">{job.error_code}</p>}
    </section>
  );
  const status: Record<string, string> = {
    pending: text("Inrichting wacht op verwerking", "Provisioning queued"),
    processing: text("Inrichting wordt verwerkt", "Provisioning in progress"),
    ready: text("Accountinrichting verwerkt", "Account provisioning processed"),
    disabled: text("Beheerde Authentik-toegang uitgeschakeld", "Managed Authentik access disabled"),
    error: text("Inrichting vereist controle", "Provisioning needs review"),
  };
  const invitations: Record<string, string> = {
    pending: text("Uitnodiging wacht op verwerking", "Invitation queued"),
    sending: text("Uitnodiging wordt aangevraagd", "Requesting invitation"),
    accepted: text(
      "Authentik heeft de mailaanvraag geaccepteerd; ontvangst en eerste Teamlogin nog controleren.",
      "Authentik accepted the email request; verify delivery and first Teamlogin.",
    ),
    uncertain: text(
      "Afleveraanvraag heeft een onbekende uitkomst. Controleer ontvangst voordat je opnieuw uitnodigt.",
      "Delivery request has an uncertain outcome. Check receipt before inviting again.",
    ),
  };
  return (
    <section className="space-y-2 rounded-lg border p-3 text-sm">
      <strong>{text("Teamaccount", "Team account")}</strong>
      <p>
        {job
          ? status[job.status]
          : text(
              "Nog geen automatische inrichting aangevraagd.",
              "Automatic provisioning has not been requested.",
            )}
      </p>
      {job && <p className="text-muted-foreground">{invitations[job.invitation_status]}</p>}
      {job?.first_team_login_at && (
        <p>{text("Eerste Teamlogin bevestigd", "First team sign-in verified")}</p>
      )}
      {job?.error_code && <p className="text-destructive">{job.error_code}</p>}
      {mailbox && (
        <p>
          {text("Persoonlijk postvak", "Personal mailbox")}: {mailbox.address} ·{" "}
          {mailbox.provisioning_status} · {text("Import", "Import")}: {mailbox.sync_status}
        </p>
      )}
      {mailbox?.last_synced_at && !mailbox?.last_sync_error_code && (
        <p>{text("Mailboxsynchronisatie geslaagd", "Mailbox sync succeeded")}</p>
      )}
      {mailbox?.provisioning_error_code && (
        <p className="text-destructive">{mailbox.provisioning_error_code}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {text(
          "De medewerker stelt via de uitnodiging MFA en een wachtwoord in. De eerste Teamlogin verbindt de persoonlijke mailbox automatisch; sleutels hoeven niet te worden gekopieerd. Een bestaande Authentik-identiteit wordt niet automatisch overgenomen.",
          "The invitation lets the staff member configure MFA and a password. The first team sign-in automatically connects the personal mailbox; no keys need to be copied. An existing Authentik identity is not automatically adopted.",
        )}
      </p>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || (!active && !job) || job?.status === "processing"}
            onClick={() => void onRequest(false)}
          >
            {text("Inrichting aanvragen / opnieuw proberen", "Request / retry provisioning")}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !active || !job || job.status === "processing"}
            onClick={() => void onRequest(true)}
          >
            {text("Opnieuw uitnodigen", "Invite again")}
          </Button>
        </div>
      )}
    </section>
  );
}

function StaffActivity({ userId }: { userId: string }) {
  const { text } = useLocale();
  const { data = [] } = useQuery({
    queryKey: ["corporate-staff-activity", userId],
    queryFn: () => getCorporateStaffActivity({ data: { userId } }),
    enabled: Boolean(userId),
  });
  return (
    <section className="space-y-2 border-t pt-4">
      <h3 className="font-medium">{text("Rechtenhistorie", "Permission history")}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {text("Nog geen wijzigingen vastgelegd.", "No changes recorded yet.")}
        </p>
      ) : (
        data.slice(0, 10).map((entry: any) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"
          >
            <span>
              <strong>{entry.action}</strong> · {entry.result}
            </span>
            <time className="text-muted-foreground">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(entry.created_at))}
            </time>
          </div>
        ))
      )}
    </section>
  );
}
