import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Plus, RefreshCw, Trash2, UserRoundPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { PlanId, TripMember, TripMemberRole } from "@/lib/types";
import { uid } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale";
import { parseBulkTripInvites, tripRoleAccess } from "@/lib/trip-member-bulk";
import {
  createTripInvitation,
  listPendingTripInvitations,
  manageTripInvitation,
  removeTripMember,
} from "@/lib/invitation.functions";

const PERSONAL_ROLES: { id: TripMemberRole; label: string; description: string }[] = [
  { id: "traveler", label: "Medereiziger", description: "Plant mee en voegt kosten toe." },
  { id: "viewer", label: "Kijker", description: "Ziet de reis, maar wijzigt niets." },
];

const AGENCY_ROLES: { id: TripMemberRole; label: string; description: string }[] = [
  { id: "advisor", label: "Reisadviseur", description: "Beheert planning en boekingen." },
  { id: "finance", label: "Financiën", description: "Beheert kosten en facturen." },
  { id: "client", label: "Klant / reiziger", description: "Ziet alleen deze reis en documenten." },
];

const labels: Record<TripMemberRole, string> = {
  owner: "Eigenaar",
  traveler: "Medereiziger",
  viewer: "Kijker",
  advisor: "Reisadviseur",
  finance: "Financiën",
  client: "Klant / reiziger",
};

export function TripMembers({
  members,
  tripId,
  plan,
  editable,
  onChange,
  ownerName = "Jij",
  ownerEmail = "Eigenaar van deze reis",
}: {
  members: TripMember[];
  tripId: string;
  plan: PlanId;
  editable: boolean;
  onChange: (members: TripMember[]) => Promise<void>;
  ownerName?: string;
  ownerEmail?: string;
}) {
  const { text } = useLocale();
  const queryClient = useQueryClient();
  const roles = plan === "agency" ? AGENCY_ROLES : PERSONAL_ROLES;
  const maxMembers = plan === "free" ? 2 : Infinity;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TripMemberRole>(roles[0]!.id);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const invitationsQuery = useQuery({
    queryKey: ["pending-trip-invitations", tripId],
    queryFn: () => listPendingTripInvitations({ data: { tripId } }),
    enabled: editable,
  });
  const bulkPreview = parseBulkTripInvites(
    bulkInput,
    roles.map((item) => item.id),
    [...members.map((member) => member.email), ...(invitationsQuery.data ?? []).map((invitation) => invitation.email)],
  );

  async function saveMembers(next: TripMember[], successMessage: string) {
    setSaving(true);
    try {
      await onChange(next);
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Reisgenoten konden niet worden opgeslagen.", "Travellers could not be saved."),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addMember() {
    if (!name.trim() || !email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error(
        text("Vul een naam en geldig e-mailadres in.", "Enter a name and valid email address."),
      );
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === email.trim().toLowerCase())) {
      toast.error(
        text(
          "Dit e-mailadres is al toegevoegd aan deze reis.",
          "This email address has already been added to this trip.",
        ),
      );
      return;
    }
    if (members.length >= maxMembers) {
      toast.error(
        text(
          "Free bevat maximaal twee reisgenoten. Upgrade naar Pro voor onbeperkt.",
          "Free supports up to two travellers. Upgrade to Pro for unlimited travellers.",
        ),
      );
      return;
    }
    const saved = await saveMembers(
      [
        ...members,
        {
          id: uid(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          status: "invited",
          invitedAt: new Date().toISOString(),
        },
      ],
      text("Reisgenoot toegevoegd. De genodigde krijgt pas toegang na acceptatie.", "Traveller added. The invitee gets access only after accepting."),
    );
    if (!saved) return;
    try {
      const invitation = await createTripInvitation({ data: { tripId, email: email.trim().toLowerCase(), role } });
      setInviteLink(`${window.location.origin}/invite/${invitation.token}`);
      await queryClient.invalidateQueries({ queryKey: ["pending-trip-invitations", tripId] });
      if (invitation.mailDelivery === "failed")
        toast.warning(text("Uitnodiging aangemaakt, maar de e-mail kon niet worden klaargezet. Deel de getoonde link zelf.", "Invitation created, but the email could not be queued. Share the displayed link yourself."));
      else
        toast.success(text("Uitnodiging aangemaakt. Kopieer de link om hem zelf te delen.", "Invitation created. Copy the link to share it yourself."));
    } catch {
      toast.error(text("De reisgenoot is bewaard, maar de beveiligde uitnodigingslink kon niet worden gemaakt.", "The traveller was saved, but the secure invitation link could not be created."));
    }
    setName("");
    setEmail("");
  }

  async function addBulkMembers() {
    const available = Number.isFinite(maxMembers) ? Math.max(0, maxMembers - members.length) : bulkPreview.invites.length;
    const chosen = bulkPreview.invites.slice(0, available);
    if (!chosen.length || bulkPreview.issues.length || chosen.length !== bulkPreview.invites.length) {
      toast.error(text("Los eerst de ongeldige, dubbele of te veel ingevoerde regels op.", "Resolve invalid, duplicate or excess rows first."));
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await onChange([...members, ...chosen.map((invite) => ({ id: uid(), ...invite, status: "invited" as const, invitedAt: now }))]);
      let failed = 0;
      for (const invite of chosen) {
        try { await createTripInvitation({ data: { tripId, email: invite.email, role: invite.role } }); }
        catch { failed += 1; }
      }
      await queryClient.invalidateQueries({ queryKey: ["pending-trip-invitations", tripId] });
      setBulkInput(""); setBulkOpen(false);
      if (failed) toast.warning(text(`${chosen.length - failed} uitnodigingen aangemaakt; ${failed} link(s) mislukten.`, `${chosen.length - failed} invitations created; ${failed} link(s) failed.`));
      else toast.success(text(`${chosen.length} uitnodigingen aangemaakt.`, `${chosen.length} invitations created.`));
    } catch {
      toast.error(text("De groepsuitnodigingen konden niet worden opgeslagen.", "The group invitations could not be saved."));
    } finally { setSaving(false); }
  }

  async function manageInvitation(invitationId: string, invitationEmail: string, action: "revoke" | "renew") {
    if (action === "revoke" && !window.confirm(text(
      `Uitnodiging voor ${invitationEmail} intrekken? De huidige link werkt daarna niet meer.`,
      `Revoke the invitation for ${invitationEmail}? The current link will stop working.`,
    ))) return;
    setSaving(true);
    try {
      const result = await manageTripInvitation({ data: { tripId, invitationId, action } });
      if (action === "renew" && result.token) {
        setInviteLink(`${window.location.origin}/invite/${result.token}`);
        if (result.mailDelivery === "failed")
          toast.warning(text("Nieuwe link gemaakt, maar de e-mail kon niet worden klaargezet. Deel de link zelf.", "New link created, but the email could not be queued. Share the link yourself."));
        else
          toast.success(text("Nieuwe uitnodigingslink gemaakt. Deel alleen deze nieuwe link.", "A new invitation link was created. Share only this new link."));
      } else {
        await onChange(members.filter((member) => member.email.trim().toLowerCase() !== invitationEmail.toLowerCase()));
        toast.success(text("Uitnodiging ingetrokken.", "Invitation revoked."));
      }
      await queryClient.invalidateQueries({ queryKey: ["pending-trip-invitations", tripId] });
    } catch {
      toast.error(text("De uitnodiging kon niet worden beheerd.", "The invitation could not be managed."));
    } finally {
      setSaving(false);
    }
  }

  function updateMember(id: string, patch: Partial<Pick<TripMember, "role">>) {
    void saveMembers(
      members.map((member) => (member.id === id ? { ...member, ...patch } : member)),
      text("Reisgenoot bijgewerkt.", "Traveller updated."),
    );
  }

  async function removeMember(member: TripMember) {
    setSaving(true);
    try {
      await removeTripMember({ data: { tripId, memberId: member.id } });
      const email = member.email.trim().toLowerCase();
      await onChange(
        members.filter((item) => item.email.trim().toLowerCase() !== email),
      );
      toast.success(text("Reisgenoot verwijderd.", "Traveller removed."));
    } catch (error) {
      toast.error(
        error instanceof Error && !error.message.startsWith("MEMBER_")
          ? error.message
          : text(
              "Reisgenoot kon niet worden verwijderd. Probeer het opnieuw.",
              "Traveller could not be removed. Please try again.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4" /> {text("Reisgenoten", "Travellers")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {text(
            "Voeg reisgenoten toe met een rol voor alleen deze reis. Deel daarna de beveiligde link; bestaande accounts krijgen ook een melding. Toegang ontstaat pas nadat de genodigde accepteert. Uitnodigingsmails volgen zodra app-e-mail is geactiveerd.",
            "Add travellers with a role for this trip, then share the secure link. Existing accounts also receive a notification. Access is granted only after the invitee accepts. Invitation emails will follow once app email is enabled.",
          )}
        </p>
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            value={name}
            disabled={!editable || saving}
            placeholder={text("Naam", "Name")}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            type="email"
            value={email}
            disabled={!editable || saving}
            placeholder="E-mail"
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            aria-label={text("Rol reisgenoot", "Traveller role")}
            className="rounded-lg border border-input bg-card px-3 text-sm"
            value={role}
            disabled={!editable || saving}
            onChange={(event) => setRole(event.target.value as TripMemberRole)}
          >
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {roleLabel(item.id, item.label, text)}
              </option>
            ))}
          </select>
          <Button disabled={!editable || saving} onClick={() => void addMember()}>
            <Plus className="size-4" /> {text("Toevoegen", "Add")}
          </Button>
        </div>
        {editable && <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={() => setBulkOpen(true)}><UserRoundPlus className="size-4" />{text("Meerdere uitnodigen", "Invite multiple")}</Button>}
        {inviteLink && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="flex items-center gap-2 text-sm font-medium"><Link2 className="size-4" />{text("Uitnodigingslink", "Invitation link")}</p><p className="mt-1 text-xs text-muted-foreground">{text("Deze link wordt alleen nu volledig getoond en verloopt na zeven dagen.", "This link is shown in full only now and expires after seven days.")}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input className="min-w-0" readOnly value={inviteLink} aria-label={text("Uitnodigingslink", "Invitation link")} /><Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); toast.success(text("Link gekopieerd.", "Link copied.")); } catch { toast.error(text("Kopiëren lukte niet. Selecteer de link handmatig.", "Copying failed. Select the link manually.")); } }}><Copy className="size-4" />{text("Kopiëren", "Copy")}</Button></div></div>}
        {editable && (invitationsQuery.data?.length ?? 0) > 0 && (
          <section className="rounded-xl border border-border bg-muted/20 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <UserRoundPlus className="size-4" /> {text("Openstaande uitnodigingen", "Pending invitations")}
            </h3>
            <div className="mt-3 space-y-2">
              {invitationsQuery.data!.map((invitation) => (
                <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(invitation.role, labels[invitation.role], text)} · {invitation.status === "expired"
                        ? text("Verlopen", "Expired")
                        : `${text("Geldig tot", "Valid until")} ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expiresAt))}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text("E-mail", "Email")}: {invitation.emailStatus ? emailDeliveryLabel(invitation.emailStatus, text) : text("Niet klaargezet", "Not queued")}
                      {invitation.emailError ? ` · ${invitation.emailError}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void manageInvitation(invitation.id, invitation.email, "renew")}>
                      <RefreshCw className="size-4" /> {text("Nieuwe link", "New link")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void manageInvitation(invitation.id, invitation.email, "revoke")}>
                      <X className="size-4" /> {text("Intrekken", "Revoke")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="space-y-2">
          <MemberRow name={ownerName} email={ownerEmail} role="owner" status="active" owner />
          {members.map((member) => (
            <MemberRow
              key={member.id}
              {...member}
              roles={roles}
              editable={editable && !saving}
              onChangeRole={(nextRole) => updateMember(member.id, { role: nextRole })}
              {...(editable ? { onRemove: () => void removeMember(member) } : {})}
            />
          ))}
        </div>
        {plan === "free" && (
          <p className="text-xs text-muted-foreground">
            {text(
              "Free: maximaal twee reisgenoten per reis. Pro biedt onbeperkte reisgenoten.",
              "Free: up to two travellers per trip. Pro offers unlimited travellers.",
            )}
          </p>
        )}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{text("Meerdere reisgenoten uitnodigen", "Invite multiple travellers")}</DialogTitle>
              <DialogDescription>{text("Zet één persoon per regel: naam, e-mailadres, rol. Controleer de toegang voordat je verstuurt.", "Enter one person per line: name, email address, role. Review access before sending.")}</DialogDescription>
            </DialogHeader>
            <Textarea value={bulkInput} onChange={(event) => setBulkInput(event.target.value)} rows={7} placeholder={`Alex, alex@example.com, ${roles[0]!.id}\nSam, sam@example.com, ${roles.at(-1)!.id}`} />
            <p className="text-xs text-muted-foreground">{text("Toegestane rollen", "Allowed roles")}: {roles.map((item) => item.id).join(", ")}</p>
            {bulkPreview.invites.length > 0 && <div className="space-y-2">
              <p className="text-sm font-semibold">{text("Voorbeeld van toegang", "Access preview")}</p>
              {bulkPreview.invites.map((invite) => <div key={invite.email} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{invite.name} · {invite.email}</span><Badge variant="secondary">{roleLabel(invite.role, labels[invite.role], text)}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{tripRoleAccess(invite.role).map((access) => accessLabel(access, text)).join(" · ")}</p>
              </div>)}
            </div>}
            {bulkPreview.issues.length > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {bulkPreview.issues.map((issue) => <p key={`${issue.line}-${issue.reason}`}>{text("Regel", "Line")} {issue.line}: {issueLabel(issue.reason, text)}</p>)}
            </div>}
            {Number.isFinite(maxMembers) && <p className="text-xs text-muted-foreground">{text(`Nog ${Math.max(0, maxMembers - members.length)} plaatsen beschikbaar in Free.`, `${Math.max(0, maxMembers - members.length)} places remain on Free.`)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>{text("Annuleren", "Cancel")}</Button>
              <Button type="button" disabled={saving || !bulkPreview.invites.length || bulkPreview.issues.length > 0 || members.length + bulkPreview.invites.length > maxMembers} onClick={() => void addBulkMembers()}>{text(`Uitnodigen (${bulkPreview.invites.length})`, `Invite (${bulkPreview.invites.length})`)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function emailDeliveryLabel(status:string,text:(nl:string,en:string)=>string){return({held:text("vastgehouden","held"),pending:text("in wachtrij","queued"),processing:text("wordt verzonden","sending"),sent:text("verzonden","sent"),failed:text("mislukt","failed"),cancelled:text("geannuleerd","cancelled")} as Record<string,string>)[status]??status}

function MemberRow({
  name,
  email,
  role,
  status,
  owner,
  roles,
  editable,
  onChangeRole,
  onRemove,
}: Pick<TripMember, "name" | "email" | "role" | "status"> & {
  owner?: boolean;
  roles?: { id: TripMemberRole; label: string }[];
  editable?: boolean;
  onChangeRole?: (role: TripMemberRole) => void;
  onRemove?: () => void;
}) {
  const { text } = useLocale();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {editable && roles && onChangeRole ? (
          <select
            aria-label={`${text("Rol van", "Role of")} ${name}`}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs"
            value={role}
            onChange={(event) => onChangeRole(event.target.value as TripMemberRole)}
          >
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {roleLabel(item.id, item.label, text)}
              </option>
            ))}
          </select>
        ) : (
          <Badge variant="secondary">{roleLabel(role, labels[role], text)}</Badge>
        )}
        {!owner && (
          <Badge variant={status === "active" ? "default" : "outline"}>
            {status === "active" ? text("Actief", "Active") : text("Uitgenodigd", "Invited")}
          </Badge>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={text(`${name} verwijderen`, `Remove ${name}`)}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </span>
    </div>
  );
}

function accessLabel(access: string, text: (nl: string, en: string) => string) {
  const labelsByAccess: Record<string, [string, string]> = {
    view: ["Reis bekijken", "View trip"], plan: ["Planning wijzigen", "Edit planning"],
    expenses: ["Uitgaven beheren", "Manage expenses"], members: ["Reisgenoten beheren", "Manage travellers"],
  };
  const label = labelsByAccess[access] ?? [access, access];
  return text(label[0], label[1]);
}

function issueLabel(reason: string, text: (nl: string, en: string) => string) {
  const issues: Record<string, [string, string]> = {
    invalid: ["gebruik naam, geldig e-mailadres en rol", "use name, valid email address and role"],
    role: ["de rol is niet toegestaan", "the role is not allowed"],
    duplicate: ["dit e-mailadres staat meer dan één keer in de lijst", "this email address occurs more than once"],
    existing: ["deze persoon is al lid of uitgenodigd", "this person is already a member or invited"],
  };
  const label = issues[reason] ?? [reason, reason];
  return text(label[0], label[1]);
}

function roleLabel(
  role: TripMemberRole,
  fallback: string,
  text: (nl: string, en: string) => string,
) {
  const english: Record<TripMemberRole, string> = {
    owner: "Owner",
    traveler: "Traveller",
    viewer: "Viewer",
    advisor: "Travel advisor",
    finance: "Finance",
    client: "Client / traveller",
  };
  return text(fallback, english[role]);
}
