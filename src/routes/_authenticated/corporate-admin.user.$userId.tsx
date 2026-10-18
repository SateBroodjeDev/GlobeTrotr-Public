import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Route as RouteIcon,
  ShieldCheck,
  Save,
  Trash2,
  Unlink,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiQuotaManager } from "@/components/ApiQuotaManager";
import { Metric } from "@/lib/corporate-admin-ui";
import {
  getPlatformUserDetail,
  deletePlatformUser,
  resetPlatformUserMfa,
  setPlatformUserBlocked,
  unlinkPlatformUserIdentity,
  updatePlatformUserAccount,
} from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/user/$userId")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const { text } = useLocale();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);
  const [resettingMfa, setResettingMfa] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifyDeletion, setNotifyDeletion] = useState(true);
  const [deletionReason, setDeletionReason] = useState("");
  const [account, setAccount] = useState({ displayName: "", email: "", phone: "", locale: "nl-NL" as "nl-NL"|"en-GB",plan:"free" as "free"|"pro"|"agency",publicSlug:"",biography:"",publicProfileEnabled:false,friendRequestsEnabled:true,visitedCountries:[] as string[] });
  const query = useQuery({
    queryKey: ["platform-user-detail", userId],
    queryFn: () => getPlatformUserDetail({ data: { userId } }),
  });
  const detail = query.data;
  useEffect(() => {
    if (!detail) return;
    setAccount({ displayName: detail.user.displayName, email: detail.user.email, phone: detail.user.phone ?? "", locale: detail.user.locale === "en-GB" ? "en-GB" : "nl-NL",plan:detail.workspace?.plan === "pro" || detail.workspace?.plan === "agency" ? detail.workspace.plan : "free",publicSlug:detail.user.publicSlug??"",biography:detail.user.biography??"",publicProfileEnabled:Boolean(detail.user.publicProfileEnabled),friendRequestsEnabled:detail.user.friendRequestsEnabled!==false,visitedCountries:detail.user.visitedCountries??[] });
  }, [detail]);

  async function saveAccount() {
    try {
      await updatePlatformUserAccount({ data: { userId, ...account, publicProfileEnabled: detail?.user.agencyAccount ? false : account.publicProfileEnabled, reason } });
      setReason(""); await query.refetch();
      toast.success(text("Accountgegevens bijgewerkt.", "Account details updated."));
    } catch { toast.error(text("Accountgegevens konden niet worden bijgewerkt.", "Account details could not be updated.")); }
  }

  async function unlinkIdentity(identityId:string) {
    try {
      await unlinkPlatformUserIdentity({ data: { userId, identityId, reason } });
      setReason(""); await query.refetch();
      toast.success(text("Koppeling verwijderd.", "Connection removed."));
    } catch { toast.error(text("Koppeling kon niet worden verwijderd.", "Connection could not be removed.")); }
  }

  async function removeAccount() {
    setDeleting(true);
    try {
      const result = await deletePlatformUser({ data: { userId, notify: notifyDeletion, reason: deletionReason } });
      toast.success(notifyDeletion && !result.mailQueued
        ? text("Account verwijderd, maar de bevestigingsmail kon niet worden klaargezet.", "Account deleted, but the confirmation email could not be queued.")
        : text("Account definitief verwijderd.", "Account permanently deleted."));
      await navigate({ to: "/corporate-admin/users", replace: true });
    } catch { toast.error(text("Account kon niet worden verwijderd. Corporate Admin-accounts zijn beschermd.", "Account could not be deleted. Corporate Admin accounts are protected.")); }
    finally { setDeleting(false); }
  }
  const date = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(value),
        )
      : text("Niet beschikbaar", "Not available");
  const blocked = Boolean(
    detail?.user.blockedUntil && Date.parse(detail.user.blockedUntil) > Date.now(),
  );

  async function changeBlockState() {
    setSavingBlock(true);
    try {
      await setPlatformUserBlocked({ data: { userId, blocked: !blocked, reason } });
      setReason("");
      await query.refetch();
      toast.success(
        blocked
          ? text("Account hersteld.", "Account restored.")
          : text("Account tijdelijk geblokkeerd.", "Account temporarily blocked."),
      );
    } catch {
      toast.error(
        text(
          "De accountstatus kon niet worden gewijzigd.",
          "The account status could not be changed.",
        ),
      );
    } finally {
      setSavingBlock(false);
    }
  }

  async function resetMfa() {
    if (
      reason.trim().length < 10 ||
      !window.confirm(
        text(
          "Alle authenticatorcodes voor dit account verwijderen?",
          "Remove all authenticator codes for this account?",
        ),
      )
    )
      return;
    setResettingMfa(true);
    try {
      const result = await resetPlatformUserMfa({ data: { userId, reason } });
      setReason("");
      toast.success(
        text(
          `${result.removed} authenticator(s) verwijderd.`,
          `${result.removed} authenticator(s) removed.`,
        ),
      );
    } catch {
      toast.error(text("2FA kon niet worden hersteld.", "2FA could not be reset."));
    } finally {
      setResettingMfa(false);
    }
  }

  if (query.isLoading)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {text("Gebruikersgegevens laden…", "Loading user details…")}
        </CardContent>
      </Card>
    );
  if (query.isError || !detail)
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p>
            {text(
              "De gebruikersgegevens konden niet worden geladen.",
              "The user details could not be loaded.",
            )}
          </p>
          <Button asChild variant="outline">
            <Link to="/corporate-admin/users">
              {text("Terug naar gebruikers", "Back to users")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="-ml-3">
        <Link to="/corporate-admin/users">
          <ArrowLeft className="size-4" />
          {text("Terug naar gebruikers", "Back to users")}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate">
                {detail.user.displayName || text("Naamloos account", "Unnamed account")}
              </CardTitle>
              <p className="mt-1 break-all text-sm text-muted-foreground">{detail.user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{detail.workspace?.plan ?? "free"}</Badge>
              <Badge variant={detail.user.emailConfirmed ? "secondary" : "outline"}>
                {detail.user.emailConfirmed
                  ? text("Bevestigd", "Confirmed")
                  : text("Onbevestigd", "Unconfirmed")}
              </Badge>
              <Badge variant={blocked ? "destructive" : "secondary"}>
                {blocked ? text("Geblokkeerd", "Blocked") : text("Actief", "Active")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info
              label={text("Account aangemaakt", "Account created")}
              value={date(detail.user.createdAt)}
            />
            <Info
              label={text("Laatste login", "Last sign-in")}
              value={date(detail.user.lastSignInAt)}
            />
            <Info
              label={text("Workspace aangemaakt", "Workspace created")}
              value={date(detail.workspace?.createdAt)}
            />
            <Info
              label={text("Laatste workspace-activiteit", "Latest workspace activity")}
              value={date(detail.workspace?.updatedAt)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="font-medium">
                {blocked
                  ? text("Accounttoegang herstellen", "Restore account access")
                  : text("Account tijdelijk blokkeren", "Temporarily block account")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {blocked
                  ? text(
                      "De gebruiker kan na herstel weer inloggen.",
                      "The user can sign in again after restoration.",
                    )
                  : text(
                      "De gebruiker kan niet meer inloggen totdat een beheerder het account herstelt.",
                      "The user cannot sign in until an administrator restores the account.",
                    )}
              </p>
            </div>
            <AlertDialog onOpenChange={(open) => !open && setReason("")}>
              <AlertDialogTrigger asChild>
                <Button variant={blocked ? "outline" : "destructive"}>
                  {blocked ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <LockKeyhole className="size-4" />
                  )}
                  {blocked
                    ? text("Account herstellen", "Restore account")
                    : text("Account blokkeren", "Block account")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {blocked
                      ? text("Accounttoegang herstellen?", "Restore account access?")
                      : text("Account tijdelijk blokkeren?", "Temporarily block account?")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {blocked
                      ? text(
                          "Hiermee kan deze gebruiker direct weer inloggen. Geef een interne reden op; de actie wordt vastgelegd.",
                          "This immediately allows the user to sign in again. Provide an internal reason; the action is logged.",
                        )
                      : text(
                          "Hiermee verliest deze gebruiker direct de mogelijkheid om in te loggen. Reizen en gegevens blijven bewaard. Geef een interne reden op; de actie wordt vastgelegd.",
                          "This immediately prevents the user from signing in. Trips and data remain stored. Provide an internal reason; the action is logged.",
                        )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">
                    {text("Reden (verplicht)", "Reason (required)")}
                  </span>
                  <Input
                    value={reason}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={text("Minimaal 10 tekens", "At least 10 characters")}
                  />
                </label>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={savingBlock}>
                    {text("Annuleren", "Cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className={
                      blocked
                        ? ""
                        : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    }
                    disabled={reason.trim().length < 10 || savingBlock}
                    onClick={(event) => {
                      void changeBlockState();
                    }}
                  >
                    {savingBlock
                      ? text("Bezig…", "Working…")
                      : blocked
                        ? text("Toegang herstellen", "Restore access")
                        : text("Account blokkeren", "Block account")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{text("Accountgegevens bekijken en bewerken", "View and edit account details")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{text("Wijzig naam, e-mail, telefoonnummer en voorkeurstaal. Alle wijzigingen komen in de auditlog.", "Change name, email, phone number and preferred language. Every change is recorded in the audit log.")}</p></CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1 text-sm"><span>{text("Auditreden voor beheersacties", "Audit reason for administrative actions")}</span><Input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder={text("Verplicht, minimaal 10 tekens", "Required, at least 10 characters")}/></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">{text("Naam", "Name")}<Input value={account.displayName} onChange={e=>setAccount({...account,displayName:e.target.value})}/></label>
            <label className="space-y-1 text-sm">E-mail<Input type="email" value={account.email} onChange={e=>setAccount({...account,email:e.target.value})}/></label>
            <label className="space-y-1 text-sm">{text("Telefoonnummer", "Phone number")}<Input value={account.phone} onChange={e=>setAccount({...account,phone:e.target.value})}/></label>
            <label className="space-y-1 text-sm">{text("Voorkeurstaal", "Preferred language")}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={account.locale} onChange={e=>setAccount({...account,locale:e.target.value as "nl-NL"|"en-GB"})}><option value="nl-NL">Nederlands</option><option value="en-GB">English</option></select></label>
            <label className="space-y-1 text-sm">{text("Abonnement", "Plan")}<select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={account.plan} onChange={e=>setAccount({...account,plan:e.target.value as "free"|"pro"|"agency"})}><option value="free">Free</option><option value="pro">Pro</option><option value="agency">Agency</option></select></label>
            <label className="space-y-1 text-sm">{text("Publieke gebruikersnaam", "Public username")}<Input value={account.publicSlug} maxLength={40} onChange={e=>setAccount({...account,publicSlug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})}/></label>
            <label className="space-y-1 text-sm sm:col-span-2">{text("Openbare biografie", "Public biography")}<Textarea value={account.biography} maxLength={500} onChange={e=>setAccount({...account,biography:e.target.value})}/><span className="block text-right text-xs text-muted-foreground">{account.biography.length}/500</span></label>
            <label className="space-y-1 text-sm sm:col-span-2">{text("Bezochte landen", "Visited countries")}<Input value={account.visitedCountries.join(", ")} onChange={e=>setAccount({...account,visitedCountries:e.target.value.split(",").map(value=>value.trim()).filter(Boolean).slice(0,100)})}/><span className="block text-xs text-muted-foreground">{text("Komma-gescheiden; maximaal 100 landen.","Comma-separated; up to 100 countries.")}</span></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!detail.user.agencyAccount&&account.publicProfileEnabled} disabled={detail.user.agencyAccount} onChange={e=>setAccount({...account,publicProfileEnabled:e.target.checked})}/>{text("Openbaar profiel actief", "Public profile enabled")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={account.friendRequestsEnabled} onChange={e=>setAccount({...account,friendRequestsEnabled:e.target.checked})}/>{text("Vriendschapsverzoeken toegestaan", "Friend requests allowed")}</label>
          </div>
          {detail.user.agencyAccount&&<p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{text("Dit account is eigenaar of actief intern teamlid van een Agency-workspace. Een openbaar reizigersprofiel is daarom uitgeschakeld.","This account owns or actively belongs to an Agency workspace. Its public traveler profile is therefore disabled.")}</p>}
          <Button disabled={reason.trim().length<10||!account.displayName.trim()||!account.email.trim()} onClick={()=>void saveAccount()}><Save className="size-4"/>{text("Gegevens opslaan", "Save details")}</Button>
          {detail.user.publicProfileEnabled&&detail.user.publicSlug&&<Button variant="outline" asChild><Link to="/users/$username" params={{username:detail.user.publicSlug}}><ExternalLink className="size-4"/>{text("Open openbaar profiel", "Open public profile")}</Link></Button>}
        </CardContent>
      </Card>
      {detail.workspace?.id && <ApiQuotaManager workspaceId={detail.workspace.id} userId={userId} />}
      <Card>
        <CardHeader><CardTitle>{text("Inlogmethoden", "Sign-in methods")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">{detail.user.identities.map((identity:any)=><div key={identity.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><strong className="capitalize">{identity.provider}</strong><p className="text-xs text-muted-foreground">{identity.provider==="email"?text("Basislogin kan niet worden ontkoppeld.","Primary sign-in cannot be disconnected."):text("Externe accountkoppeling", "External account connection")}</p></div><Button variant="outline" size="sm" disabled={identity.provider==="email"||reason.trim().length<10} onClick={()=>void unlinkIdentity(identity.id)}><Unlink className="size-4"/>{text("Ontkoppelen", "Disconnect")}</Button></div>)}</CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_20rem_auto] md:items-end">
          <div>
            <p className="font-medium">
              {text(
                "2FA-herstel na identiteitscontrole",
                "2FA recovery after identity verification",
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {text(
                "Vul een auditreden in en verwijder de TOTP-factor, zodat de gebruiker opnieuw kan instellen.",
                "Enter an audit reason and remove the TOTP factor so the user can enrol again.",
              )}
            </p>
          </div>
          <Input
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={text("Reden, minimaal 10 tekens", "Reason, at least 10 characters")}
          />
          <Button
            variant="outline"
            disabled={resettingMfa || reason.trim().length < 10}
            onClick={() => void resetMfa()}
          >
            {text("2FA herstellen", "Reset 2FA")}
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-destructive">{text("Account definitief verwijderen", "Permanently delete account")}</CardTitle><p className="text-sm text-muted-foreground">{text("Dit verwijdert de login en gekoppelde persoonsgegevens definitief. Corporate Admin-accounts en je eigen account zijn beschermd.", "This permanently removes the sign-in and associated personal data. Corporate Admin accounts and your own account are protected.")}</p></CardHeader>
        <CardContent className="space-y-4"><label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="mt-1" checked={notifyDeletion} onChange={e=>setNotifyDeletion(e.target.checked)}/><span><strong>{text("Gebruiker per e-mail informeren", "Notify user by email")}</strong><span className="mt-1 block text-xs text-muted-foreground">{text("De mail wordt automatisch in de voorkeurstaal van het account verstuurd.", "The email is automatically sent in the account's preferred language.")}</span></span></label><label className="block space-y-1 text-sm"><span>{text("Reden voor verwijdering", "Deletion reason")}</span><Textarea value={deletionReason} maxLength={500} onChange={e=>setDeletionReason(e.target.value)} placeholder={text("Verplicht, minimaal 10 tekens", "Required, at least 10 characters")}/></label><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={deletionReason.trim().length<10}><Trash2 className="size-4"/>{text("Account verwijderen", "Delete account")}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{text("Account onherroepelijk verwijderen?", "Permanently delete account?")}</AlertDialogTitle><AlertDialogDescription>{text("Deze actie kan niet worden teruggedraaid. Controleer de auditreden en de keuze voor de melding.", "This action cannot be undone. Check the audit reason and notification choice.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{text("Annuleren", "Cancel")}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting||deletionReason.trim().length<10} onClick={()=>void removeAccount()}>{deleting?text("Verwijderen…","Deleting…"):text("Definitief verwijderen","Delete permanently")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={RouteIcon}
          label={text("Alle reizen", "All trips")}
          value={detail.tripCounts.total}
          detail={text("Eigen reizen", "Owned trips")}
        />
        <Metric
          icon={CalendarDays}
          label={text("Actief", "Active")}
          value={detail.tripCounts.active}
          detail={text("Niet gearchiveerd", "Not archived")}
        />
        <Metric
          icon={Globe2}
          label={text("Openbaar", "Public")}
          value={detail.tripCounts.public}
          detail={text("Actief en openbaar", "Active and public")}
        />
        <Metric
          icon={Archive}
          label={text("Gearchiveerd", "Archived")}
          value={detail.tripCounts.archived}
          detail={text("Eigen archief", "Owned archive")}
        />
        <Metric
          icon={Users}
          label={text("Gedeeld met gebruiker", "Shared with user")}
          value={detail.tripCounts.shared}
          detail={text("Actieve deelnames", "Active memberships")}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{text("Recent bijgewerkte reizen", "Recently updated trips")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.recentTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {text(
                "Deze gebruiker heeft nog geen eigen reizen.",
                "This user does not own any trips yet.",
              )}
            </p>
          ) : (
            detail.recentTrips.map((trip: any) => (
              <div
                key={trip.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{trip.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {trip.start || text("Geen startdatum", "No start date")} ·{" "}
                    {text("gewijzigd", "updated")} {date(trip.updatedAt)}
                  </span>
                </div>
                {trip.public && (
                  <Badge variant="secondary">
                    <ExternalLink className="mr-1 size-3" />
                    {text("Openbaar", "Public")}
                  </Badge>
                )}
                {trip.archived && (
                  <Badge variant="outline">{text("Gearchiveerd", "Archived")}</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
