import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  CreditCard,
  Download,
  KeyRound,
  Languages,
  Link2,
  Mail,
  Monitor,
  ShieldCheck,
  Trash2,
  Upload,
  Unlink,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { countsTowardsTripLimit, ownsTrip, planOf } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/locale";
import {
  deleteAccount,
  exportAccountData,
  recordAccountSecurityEvent,
} from "@/lib/account.functions";
import { openPrivacyChoices } from "@/lib/privacy-consent";
import { TEMPLATES, tripStatus, type Trip, type WorkspaceState } from "@/lib/types";
import { TRIP_NAME_MAX_LENGTH } from "@/lib/trip-limits";
import { listMyPrivacyRequests, submitPrivacyRequest } from "@/lib/maintenance.functions";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PushNotificationControl } from "@/components/PushNotificationControl";
import { agencyHostLookup } from "@/lib/agency-domain";
import { getStaffLinkAccess, recordStaffLink } from "@/lib/staff-sso.functions";
import { STAFF_LINK_STORAGE_KEY, staffLinkOptions } from "@/lib/staff-sso";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { syncStaffProfile } from "@/lib/staff-profile-sync.functions";

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: (search: Record<string, unknown>): { privacyRequest?: boolean } => ({
    privacyRequest: search.privacyRequest === true || search.privacyRequest === "true",
  }),
  head: () => ({ meta: [{ title: "Accountinstellingen - GlobeTrotr" }] }),
  component: AccountPage,
});

type Profile = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  locale: string | null;
  theme: string | null;
  timezone: string | null;
  notification_preferences: Record<string, boolean> | null;
};

const DEFAULT_COMMUNICATION = {
  invitations: true,
  tripUpdates: true,
  payments: true,
  flightAlerts: true,
  productUpdates: false,
  pushInvitations: true,
  pushTripUpdates: true,
  pushPayments: true,
  pushFlightAlerts: true,
  pushAccountService: true,
};

type ThemePreference = "system" | "light" | "dark";
const OAUTH_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
] as const;

const LANGUAGES = [
  { value: "nl-NL", label: "Nederlands" },
  { value: "en-GB", label: "English" },
] as const;

const TIMEZONES = [
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "UTC", label: "UTC" },
] as const;

function asThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function AccountPage() {
  const { user: authenticatedUser, refreshUser } = useAuth();
  // This route is mounted below the authenticated layout, which guarantees a user.
  const user = authenticatedUser!;
  const { state, cloud, addTrip, saveTripNow } = useWorkspace();
  const { setLocale: applyLocale, text } = useLocale();
  const plan = planOf(state.plan);
  const activeTripCount = state.trips.filter((trip) => countsTowardsTripLimit(trip)).length;
  const historicalTripCount = state.trips.filter(
    (trip) => ownsTrip(trip.accessRole) && tripStatus(trip) === "archived",
  ).length;
  const queryClient = useQueryClient();
  const staffSecurity = useQuery({ queryKey: ["staff-security", user.id], queryFn: () => getStaffSecurityStatus(), retry: false });
  // Fail closed for credential editing while status is unavailable.
  const managedCredentials = user.app_metadata?.corporate_admin === true || staffSecurity.data?.isStaff === true;
  const personalCredentialsEditable = staffSecurity.isSuccess && !managedCredentials;
  const staffLink = useQuery({
    queryKey: ["staff-link-access", user.id],
    queryFn: () => getStaffLinkAccess(),
    enabled: typeof window !== "undefined" && window.location.hostname === "portal.globetrotr.nl",
    retry: false,
  });
  const [customAgencyDomain] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(agencyHostLookup(window.location.hostname)?.customDomain);
  });
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, email, phone, locale, theme, timezone, notification_preferences",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
  const profile = profileQuery.data;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState("nl-NL");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [saving, setSaving] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const { privacyRequest } = Route.useSearch();
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(privacyRequest === true);
  useEffect(() => {
    if (privacyRequest) setPrivacyDialogOpen(true);
  }, [privacyRequest]);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [oauthAction, setOauthAction] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [privacyType, setPrivacyType] = useState<
    "access" | "correction" | "deletion" | "restriction" | "objection" | "portability" | "other"
  >("access");
  const [privacyNotes, setPrivacyNotes] = useState("");
  const privacyRequests = useQuery({
    queryKey: ["my-privacy-requests", user.id],
    queryFn: () => listMyPrivacyRequests(),
  });
  const [submittingPrivacy, setSubmittingPrivacy] = useState(false);
  const [communication, setCommunication] = useState(DEFAULT_COMMUNICATION);
  const [savingCommunication, setSavingCommunication] = useState(false);
  const passkeys = useQuery({
    queryKey: ["account-passkeys", user.id],
    enabled: !customAgencyDomain && personalCredentialsEditable,
    queryFn: async () => {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const mfa = useQuery({
    queryKey: ["account-mfa", user.id],
    enabled: personalCredentialsEditable,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const [totpEnrollment, setTotpEnrollment] = useState<{
    id: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(profile?.display_name ?? String(user.user_metadata.full_name ?? ""));
    setEmail(user.email ?? profile?.email ?? "");
    setPhone(profile?.phone ?? String(user.user_metadata.phone ?? ""));
    setLocale(profile?.locale === "en-GB" ? "en-GB" : "nl-NL");
    setTimezone(profile?.timezone || "Europe/Amsterdam");
    setTheme(asThemePreference(profile?.theme));
    setCommunication({ ...DEFAULT_COMMUNICATION, ...(profile?.notification_preferences ?? {}) });
  }, [profile, user]);


  if (!user) return null;
  const identities = user.identities ?? [];

  async function saveProfile() {
    if (!name.trim()) {
      toast.error(text("Vul je naam in.", "Enter your name."));
      return;
    }
    const requestedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(requestedEmail)) {
      toast.error(text("Vul een geldig e-mailadres in.", "Enter a valid email address."));
      return;
    }
    setSaving(true);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: name.trim(),
        // Auth blijft de bron van waarheid voor een e-mailadres. Een nieuw
        // adres wordt daar pas actief nadat de gebruiker het heeft bevestigd.
        email: user.email ?? null,
        phone: phone.trim() || null,
      } as any);
      if (profileError) throw profileError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), phone: phone.trim() || undefined },
      });
      if (metadataError) throw metadataError;
      const teamSync = await syncStaffProfile().catch(() => ({ status: "failed" }));
      if (["failed", "not_configured", "needs_link"].includes(teamSync.status)) toast.warning(text("Naam opgeslagen in GlobeTrotr. Teamsynchronisatie is nog niet geslaagd; probeer opnieuw via Profiel.", "Name saved in GlobeTrotr. Team synchronization has not succeeded yet; retry from Profile."));

      if (requestedEmail !== (user.email ?? "").toLowerCase()) {
        if (!personalCredentialsEditable) throw new Error("STAFF_CREDENTIALS_MANAGED");
        const { error: emailError } = await supabase.auth.updateUser({ email: requestedEmail });
        if (emailError) throw emailError;
        await recordAccountSecurityEvent({ data: { event: "email_change_requested" } });
        toast.success(
          text(
            "Profiel opgeslagen. Bevestig je nieuwe e-mailadres via je mail.",
            "Profile saved. Confirm your new email address by email.",
          ),
        );
      } else {
        toast.success(text("Accountinstellingen opgeslagen.", "Account settings saved."));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-theme", user.id] }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Opslaan lukte niet.", "Saving failed."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences() {
    if (!timezone.trim()) {
      toast.error(text("Kies een tijdzone.", "Choose a time zone."));
      return;
    }
    setSavingPreferences(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        locale,
        timezone,
        theme,
      });
      if (error) throw error;
      localStorage.setItem("globetrotr.theme", theme);
      await applyLocale(locale === "en-GB" ? "en-GB" : "nl-NL");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-theme", user.id] }),
      ]);
      toast.success(text("Weergavevoorkeuren opgeslagen.", "Display preferences saved."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Voorkeuren opslaan lukte niet. Voer eerst de tijdzone-migratie uit.",
      );
    } finally {
      setSavingPreferences(false);
    }
  }

  async function saveCommunication() {
    setSavingCommunication(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, notification_preferences: communication });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success(text("Communicatievoorkeuren opgeslagen.", "Communication preferences saved."));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Opslaan is mislukt.", "Saving failed."),
      );
    } finally {
      setSavingCommunication(false);
    }
  }

  async function addPasskey() {
    if (!personalCredentialsEditable) return;
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      await passkeys.refetch();
      toast.success(text("Passkey toegevoegd.", "Passkey added."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Passkey toevoegen is mislukt.", "Adding the passkey failed."),
      );
    }
  }
  async function removePasskey(passkeyId: string) {
    if (!personalCredentialsEditable) return;
    if (!window.confirm(text("Deze passkey verwijderen?", "Delete this passkey?"))) return;
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
      await passkeys.refetch();
      toast.success(text("Passkey verwijderd.", "Passkey removed."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Passkey verwijderen is mislukt.", "Deleting the passkey failed."),
      );
    }
  }
  async function startTotp() {
    if (!personalCredentialsEditable) return;
    setMfaBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "GlobeTrotr Authenticator",
      });
      if (error) throw error;
      setTotpEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setTotpCode("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Authenticator instellen is mislukt.", "Setting up the authenticator failed."),
      );
    } finally {
      setMfaBusy(false);
    }
  }
  async function verifyTotp() {
    if (!personalCredentialsEditable) return;
    if (!totpEnrollment) return;
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpEnrollment.id,
        code: totpCode.replace(/\s/g, ""),
      });
      if (error) throw error;
      setTotpEnrollment(null);
      setTotpCode("");
      await mfa.refetch();
      toast.success(
        text("Tweestapsverificatie is ingeschakeld.", "Two-step verification is enabled."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("De code is niet geldig.", "The code is invalid."),
      );
    } finally {
      setMfaBusy(false);
    }
  }
  async function removeTotp(factorId: string) {
    if (!personalCredentialsEditable) return;
    if (!window.confirm(text("Tweestapsverificatie verwijderen?", "Remove two-step verification?")))
      return;
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await mfa.refetch();
      toast.success(text("Tweestapsverificatie verwijderd.", "Two-step verification removed."));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Verwijderen is mislukt.", "Removal failed."),
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function savePassword() {
    if (!personalCredentialsEditable) return;
    if (newPassword.length < 6) {
      toast.error(
        text(
          "Gebruik een wachtwoord van minimaal 6 tekens.",
          "Use a password of at least 6 characters.",
        ),
      );
      return;
    }
    if (newPassword !== repeatPassword) {
      toast.error(text("De wachtwoorden komen niet overeen.", "The passwords do not match."));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await recordAccountSecurityEvent({ data: { event: "password_changed" } });
      setNewPassword("");
      setRepeatPassword("");
      setPasswordDialogOpen(false);
      toast.success(text("Wachtwoord gewijzigd.", "Password changed."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Wachtwoord kon niet worden gewijzigd. Log opnieuw in en probeer het nogmaals.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function unlinkOAuth(identity: (typeof identities)[number]) {
    if (!personalCredentialsEditable) return;
    if (identities.length <= 1) {
      toast.error("Je kunt niet je laatste inlogmethode verwijderen.");
      return;
    }
    if (
      !window.confirm(`Weet je zeker dat je ${providerLabel(identity.provider)} wilt ontkoppelen?`)
    ) {
      return;
    }
    setOauthAction(`unlink-${identity.identity_id}`);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      await refreshUser();
      toast.success(text("Inlogmethode ontkoppeld.", "Sign-in method unlinked."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider ontkoppelen lukte niet.");
    } finally {
      setOauthAction(undefined);
    }
  }

  async function linkOAuth(provider: "google" | "discord") {
    if (!personalCredentialsEditable) return;
    setOauthAction(`link-${provider}`);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/oauth-callback?next=%2Faccount&linked=${provider}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setOauthAction(undefined);
      toast.error(
        error instanceof Error ? error.message : text("Koppelen is mislukt.", "Linking failed."),
      );
    }
  }

  async function linkStaff() {
    if (window.location.hostname !== "portal.globetrotr.nl" || !staffLink.data?.allowed) return;
    if (!window.confirm(text("Koppel jouw persoonlijke Authentik-teamaccount aan dit bestaande GlobeTrotr-account. Gebruik in Authentik alleen jouw eigen account.", "Link your personal Authentik team identity to this existing GlobeTrotr account. Use only your own Authentik account."))) return;
    setOauthAction("link-staff");
    try {
      const baseline = await recordStaffLink({ data: { phase: "started" } });
      if (baseline.userId !== user.id) throw new Error("STAFF_ACCOUNT_CHANGED");
      sessionStorage.setItem(STAFF_LINK_STORAGE_KEY, JSON.stringify({ userId: user.id, expiresAt: Date.now() + 15 * 60_000 }));
      const { error } = await supabase.auth.linkIdentity(staffLinkOptions());
      if (error) throw error;
    } catch {
      sessionStorage.removeItem(STAFF_LINK_STORAGE_KEY);
      setOauthAction(undefined);
      toast.error(text("Teamaccount koppelen is mislukt. Controleer je login en probeer opnieuw.", "Team account linking failed. Check your sign-in and try again."));
    }
  }

  async function downloadAccountExport() {
    setExporting(true);
    try {
      const exported = await exportAccountData();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `globetrotr-account-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success(
        text("Je gegevensexport is gedownload.", "Your data export has been downloaded."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Exporteren is mislukt.", "Export failed."),
      );
    } finally {
      setExporting(false);
    }
  }

  async function importTripBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    let imported = 0;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WorkspaceState> | Trip[];
      const trips = Array.isArray(parsed) ? parsed : parsed.trips;
      if (!Array.isArray(trips) || !trips.length) throw new Error("INVALID_BACKUP");
      const activeOwned = state.trips.filter((trip) => countsTowardsTripLimit(trip)).length;
      const activeImports = trips.filter((trip) => tripStatus(trip) !== "archived").length;
      const room = Number.isFinite(plan.tripLimit)
        ? Math.max(0, plan.tripLimit - activeOwned)
        : activeImports;
      if (activeImports > room) throw new Error("TRIP_LIMIT");
      for (const source of trips) {
        if (!source || typeof source !== "object" || typeof source.name !== "string")
          throw new Error("INVALID_BACKUP");
        const template = TEMPLATES.some((item) => item.id === source.template)
          ? source.template
          : "citytrip";
        const name = source.name.trim().slice(0, TRIP_NAME_MAX_LENGTH);
        if (!name) throw new Error("INVALID_BACKUP");
        const id = await addTrip(name, template);
        await saveTripNow(id, (created) => ({
          ...created,
          ...source,
          id,
          revision: created.revision,
          ownerId: created.ownerId,
          accessRole: "owner",
          name,
          template,
          description:
            typeof source.description === "string" ? source.description.slice(0, 375) : undefined,
          start: /^\d{4}-\d{2}-\d{2}$/.test(source.start ?? "") ? source.start : created.start,
          end: /^\d{4}-\d{2}-\d{2}$/.test(source.end ?? "") ? source.end : created.end,
          budget: Number.isFinite(source.budget) ? Math.max(0, source.budget) : created.budget,
          stops: Array.isArray(source.stops) ? source.stops : [],
          itinerary: Array.isArray(source.itinerary) ? source.itinerary : [],
          travelItems: Array.isArray(source.travelItems) ? source.travelItems : [],
          expenses: Array.isArray(source.expenses)
            ? source.expenses.map((expense) => ({
                ...expense,
                receiptPath: undefined,
                receiptName: undefined,
              }))
            : [],
          packing: Array.isArray(source.packing) ? source.packing : [],
          travelers: Array.isArray(source.travelers) ? source.travelers : [],
          members: [],
          archived: Boolean(source.archived),
          public: false,
          shareFinancials: false,
          sharePinHash: undefined,
        }));
        imported += 1;
      }
      toast.success(text(`${imported} reizen geïmporteerd.`, `${imported} trips imported.`));
    } catch (error) {
      toast.error(
        imported > 0
          ? text(
              `${imported} reizen zijn geïmporteerd; de import stopte bij een ongeldige reis.`,
              `${imported} trips were imported; import stopped at an invalid trip.`,
            )
          : error instanceof Error && error.message === "TRIP_LIMIT"
            ? text(
                "Je abonnement heeft onvoldoende ruimte voor de actieve reizen in deze back-up. Historische reizen gebruiken geen slot.",
                "Your plan does not have enough room for the active trips in this backup. Historical trips do not use a slot.",
              )
            : text(
                "Deze back-up kon niet veilig worden geïmporteerd.",
                "This backup could not be imported safely.",
              ),
      );
    } finally {
      setImporting(false);
    }
  }

  async function removeAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccount({ data: { confirmation: deleteConfirmation } });
      localStorage.removeItem(`globetrotr.workspace.v1.${user.id}`);
      localStorage.removeItem(`atlasledger.workspace.v1.${user.id}`);
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Account verwijderen is mislukt.", "Account deletion failed."),
      );
      setDeleting(false);
    }
  }
  async function sendPrivacyRequest() {
    setSubmittingPrivacy(true);
    try {
      await submitPrivacyRequest({ data: { type: privacyType, notes: privacyNotes } });
      setPrivacyNotes("");
      setPrivacyDialogOpen(false);
      await privacyRequests.refetch();
      toast.success(
        text(
          "Privacyverzoek ontvangen. We reageren normaal binnen een maand.",
          "Privacy request received. We normally respond within one month.",
        ),
      );
    } catch (error) {
      toast.error(
        String(error).includes("PRIVACY_REQUEST_LIMIT")
          ? text(
              "Je hebt al drie open privacyverzoeken.",
              "You already have three open privacy requests.",
            )
          : text(
              "Privacyverzoek kon niet worden ingediend.",
              "Privacy request could not be submitted.",
            ),
      );
    } finally {
      setSubmittingPrivacy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {text("Accountinstellingen", "Account settings")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {text(
            "Je contactgegevens, inlogmethodes, privacy en abonnement.",
            "Your contact details, sign-in methods, privacy and plan.",
          )}
        </p>
      </div>

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserRound className="size-4" /> {text("Accountgegevens", "Account details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="font-medium">{text("Accountgegevens", "Account details")}</h2>
            <p className="text-xs text-muted-foreground">{text("Je naam, contactgegevens en aanmeldadres.", "Your name, contact details and sign-in address.")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <Label htmlFor="account-name">{text("Naam", "Name")}</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <Label htmlFor="account-phone">{text("Telefoonnummer", "Phone number")}</Label>
              <Input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                placeholder={text("Optioneel", "Optional")}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="account-email">{text("E-mailadres", "Email address")}</Label>
              <Input
                id="account-email"
                disabled={!personalCredentialsEditable}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {managedCredentials ? text("Je adminaccount gebruikt centraal beheerde inloggegevens. Vraag je beheerder om een wijziging.", "Your admin account uses centrally managed credentials. Ask your administrator to make a change.") : text(
                  "Bij een nieuw adres ontvang je eerst een bevestigingsmail. Tot die bevestiging blijft je huidige e-mailadres actief.",
                  "A new address must be confirmed by email. Your current email address remains active until then.",
                )}
              </p>
            </label>
          </div>
          <Button disabled={saving || profileQuery.isLoading} onClick={saveProfile}>
            {saving
              ? text("Opslaan...", "Saving...")
              : text("Accountgegevens opslaan", "Save account details")}
          </Button>
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="size-4" />
            {text("Reisback-up importeren", "Import trip backup")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {text("Zet een GlobeTrotr JSON-back-up terug", "Restore a GlobeTrotr JSON backup")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {text(
                "Reizen worden als nieuwe privéreizen toegevoegd. Leden, publicatie, PIN en oude bonbestanden worden niet overgenomen.",
                "Trips are added as new private trips. Members, publication, PIN and old receipt files are not restored.",
              )}
            </p>
          </div>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importTripBackup(event)}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={importing}
            onClick={() => importInput.current?.click()}
          >
            <Upload className="size-4" />
            {importing
              ? text("Importeren...", "Importing...")
              : text("Back-up kiezen", "Choose backup")}
          </Button>
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Monitor className="size-4" /> {text("Taal & weergave", "Language & appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5">
              <Label htmlFor="account-locale" className="flex items-center gap-2">
                <Languages className="size-4" /> {text("Taal", "Language")}
              </Label>
              <select
                id="account-locale"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={locale}
                disabled={savingPreferences}
                onChange={(event) => setLocale(event.target.value)}
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <Label htmlFor="account-timezone" className="flex items-center gap-2">
                <Clock3 className="size-4" /> {text("Tijdzone", "Time zone")}
              </Label>
              <select
                id="account-timezone"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={timezone}
                disabled={savingPreferences}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {!TIMEZONES.some((option) => option.value === timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
                {TIMEZONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <Label htmlFor="account-theme">{text("Weergave", "Appearance")}</Label>
              <select
                id="account-theme"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={theme}
                disabled={savingPreferences}
                onChange={(event) => setTheme(asThemePreference(event.target.value))}
              >
                <option value="system">
                  {text("Systeeminstelling volgen", "Use system setting")}
                </option>
                <option value="light">{text("Lichte modus", "Light mode")}</option>
                <option value="dark">{text("Donkere modus", "Dark mode")}</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {text(
              "Je taal, tijdzone en weergave worden voor dit account opgeslagen.",
              "Your language, time zone and appearance are saved for this account.",
            )}
          </p>
          <Button disabled={savingPreferences || profileQuery.isLoading} onClick={savePreferences}>
            {savingPreferences
              ? text("Even geduld...", "Saving...")
              : text("Voorkeuren opslaan", "Save preferences")}
          </Button>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4" /> {text("Inloggen & beveiliging", "Sign-in & security")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {text(
                "Inlogmethodes die aan dit account gekoppeld zijn.",
                "Sign-in methods linked to this account.",
              )}
            </p>
            <div className="space-y-2">
              {staffLink.data?.allowed && (
                staffLink.data.linked ? (
                  <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <span>{text("GlobeTrotr Teamaccount", "GlobeTrotr Team Account")}</span>
                    <Badge variant="secondary">{text("Gekoppeld", "Linked")}</Badge>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full justify-start" disabled={Boolean(oauthAction)} onClick={() => void linkStaff()}>
                    <Link2 className="size-4" />{text("Teamaccount koppelen", "Link team account")}
                  </Button>
                )
              )}
              {personalCredentialsEditable && <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                <span>{text("E-mail en wachtwoord", "Email and password")}</span>
                <Badge variant="secondary">{text("Gekoppeld", "Linked")}</Badge>
              </div>}
              {personalCredentialsEditable && identities
                .filter((identity) =>
                  OAUTH_PROVIDERS.some((provider) => provider.id === identity.provider),
                )
                .map((identity) => (
                  <div
                    key={identity.identity_id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2"
                  >
                    <span>{providerLabel(identity.provider)}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">Gekoppeld</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={identities.length <= 1 || Boolean(oauthAction)}
                        title={`${providerLabel(identity.provider)} ontkoppelen`}
                        onClick={() => void unlinkOAuth(identity)}
                      >
                        <Unlink className="size-4" />
                      </Button>
                    </span>
                  </div>
                ))}
              {personalCredentialsEditable && OAUTH_PROVIDERS.filter(
                (provider) => !identities.some((identity) => identity.provider === provider.id),
              ).map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={Boolean(oauthAction)}
                  onClick={() => void linkOAuth(provider.id)}
                >
                  <Link2 className="size-4" />
                  {text(`${provider.label} koppelen`, `Link ${provider.label}`)}
                </Button>
              ))}
            </div>
            {personalCredentialsEditable && !customAgencyDomain && <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2"><KeyRound className="size-4" />Passkeys</span>
                  <Badge variant="secondary">{passkeys.data?.length ?? 0}</Badge>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Passkeys</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Passkeys</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text(
                      "Log veilig in met biometrie, een pincode of beveiligingssleutel.",
                      "Sign in securely with biometrics, a PIN or a security key.",
                    )}
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void addPasskey()}>
                  <KeyRound className="size-4" />
                  {text("Passkey toevoegen", "Add passkey")}
                </Button>
              </div>
              {passkeys.data?.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {passkey.friendly_name || text("Passkey", "Passkey")}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(passkey.created_at),
                      )}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removePasskey(passkey.id)}
                  >
                    {text("Verwijderen", "Delete")}
                  </Button>
                </div>
              ))}
            </div>
              </DialogContent>
            </Dialog>}
          </CardContent>
        </Card>
        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4" /> {text("Abonnement", "Plan")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cloud === "loading" ? (
              <p className="text-muted-foreground" role="status">
                {text("Abonnement laden...", "Loading plan...")}
              </p>
            ) : (
              <>
                <p>
                  {text("Huidig plan", "Current plan")}:{" "}
                  <Badge variant="secondary">{plan.name}</Badge>
                </p>
                <dl className="space-y-1">
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <dt className="text-muted-foreground">
                      {text("Actieve reizen", "Active trips")}
                    </dt>
                    <dd>
                      {activeTripCount} /{" "}
                      {Number.isFinite(plan.tripLimit)
                        ? plan.tripLimit
                        : text("onbeperkt", "unlimited")}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <dt className="text-muted-foreground">
                      {text("Historische reizen", "Historical trips")}
                    </dt>
                    <dd>{historicalTripCount} / {text("onbeperkt", "unlimited")}</dd>
                  </div>
                </dl>
                <p className="text-muted-foreground">
                  {text(
                    "Vergelijk plannen en beheer je abonnement op de abonnementspagina.",
                    "Compare plans and manage your subscription on the plan page.",
                  )}
                </p>
              </>
            )}
            <Button asChild variant="outline">
              <Link to="/billing">
                {state.plan === "free"
                  ? text("Bekijk upgrades", "View upgrades")
                  : text("Abonnement beheren", "Manage plan")}
              </Link>
            </Button>

            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {text("Inloggen en beveiliging", "Sign-in and security")}
              </p>
            </div>
            {managedCredentials && <div className="rounded-xl border border-primary/20 p-4 text-sm">
              <p className="font-medium">{text("Beveiliging via GlobeTrotr Teamaccount", "Security through your GlobeTrotr Team Account")}</p>
              <p className="mt-2 text-muted-foreground">{text("Je teamlogin, wachtwoord en 2FA beheer je via Teambeveiliging. Vraag je beheerder om hulp als je geen toegang hebt.", "Manage your team sign-in, password and MFA through team security. Ask your administrator for help if you cannot access it.")}</p>
              <a href="https://sso.globetrotr.nl/if/user/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-primary underline">{text("Teambeveiliging openen", "Open team security")}</a>
            </div>}
            {personalCredentialsEditable && <><div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {text("Authenticator-app (TOTP)", "Authenticator app (TOTP)")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text(
                      "Vraag na je wachtwoord een tijdelijke code uit je authenticator-app.",
                      "Require a temporary authenticator code after your password.",
                    )}
                  </p>
                </div>
                {!mfa.data?.totp?.length && !totpEnrollment && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mfaBusy}
                    onClick={() => void startTotp()}
                  >
                    {text("Instellen", "Set up")}
                  </Button>
                )}
              </div>
              {mfa.data?.totp?.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
                >
                  <span>
                    <strong className="block text-sm">
                      {factor.friendly_name || text("Authenticator", "Authenticator")}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {text("Actief", "Active")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mfaBusy}
                    onClick={() => void removeTotp(factor.id)}
                  >
                    {text("Verwijderen", "Delete")}
                  </Button>
                </div>
              ))}
              {totpEnrollment && (
                <div className="grid gap-3 rounded-lg bg-background p-3">
                  <img
                    src={totpEnrollment.qr}
                    alt={text("QR-code voor authenticator-app", "QR code for authenticator app")}
                    className="mx-auto size-44 rounded-lg bg-white p-2"
                  />
                  <p className="break-all text-center font-mono text-xs">{totpEnrollment.secret}</p>
                  <Label htmlFor="totp-code">
                    {text("Voer de zescijferige code in", "Enter the six-digit code")}
                  </Label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={mfaBusy || totpCode.replace(/\s/g, "").length !== 6}
                    onClick={() => void verifyTotp()}
                  >
                    {text("Controleren en inschakelen", "Verify and enable")}
                  </Button>
                </div>
              )}
              <Button
                asChild
                type="button"
                variant="link"
                className="h-auto justify-start px-0 text-xs"
              >
                <Link to="/contact">
                  {text("2FA herstellen via support", "Recover 2FA through support")}
                </Link>
              </Button>
            </div>
            <Dialog open={passwordDialogOpen} onOpenChange={(open) => {
              setPasswordDialogOpen(open);
              if (!open) { setNewPassword(""); setRepeatPassword(""); }
            }}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start gap-2">
                  <KeyRound className="size-4" />{text("Wachtwoord wijzigen", "Change password")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{text("Wachtwoord wijzigen", "Change password")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text(
                      "Gebruik minimaal 6 tekens en bewaar je wachtwoord veilig.",
                      "Use at least 6 characters and store your password securely.",
                    )}
                  </p>
                </div>
                <label className="space-y-1.5">
                  <Label htmlFor="new-password">{text("Nieuw wachtwoord", "New password")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <Label htmlFor="repeat-password">
                    {text("Herhaal nieuw wachtwoord", "Repeat new password")}
                  </Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    minLength={6}
                    autoComplete="new-password"
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  className="mt-2 w-full sm:w-auto"
                  disabled={savingPassword || !newPassword || !repeatPassword}
                  onClick={() => void savePassword()}
                >
                  <KeyRound className="size-4" />
                  {savingPassword
                    ? text("Even geduld...", "Saving password...")
                    : text("Nieuw wachtwoord opslaan", "Save new password")}
                </Button>
              </div>
              </DialogContent>
            </Dialog></>}
          </CardContent>
        </Card>
      </div>

      <Card id="communication" className="surface scroll-mt-24">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="size-4" /> {text("Communicatie", "Communication")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            {text(
              "Kies welke niet-verplichte berichten je per e-mail ontvangt. Beveiligings- en accountberichten blijven altijd aan.",
              "Choose which optional messages you receive by email. Security and account messages always remain enabled.",
            )}
          </p>
          <h3 className="font-medium">{text("E-mail", "Email")}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["invitations", text("Uitnodigingen en toegang", "Invitations and access")],
                ["tripUpdates", text("Belangrijke reiswijzigingen", "Important trip updates")],
                ["payments", text("Betalingen en verrekeningen", "Payments and settlements")],
                ["flightAlerts", text("Vluchtmeldingen", "Flight alerts")],
                ["productUpdates", text("Productnieuws", "Product news")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border p-3">
                <input
                  type="checkbox"
                  checked={communication[key]}
                  onChange={(event) =>
                    setCommunication((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="border-t pt-4">
            <h3 className="font-medium">{text("Pushmeldingen", "Push notifications")}</h3>
            <p className="mt-1 text-muted-foreground">
              {text(
                "Push is per apparaat optioneel. Kies welke soorten naar aangemelde apparaten mogen worden gestuurd. Meldingen in GlobeTrotr blijven beschikbaar.",
                "Push is optional per device. Choose which categories may be sent to registered devices. Notifications in GlobeTrotr remain available.",
              )}
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border">
              <PushNotificationControl />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["pushInvitations", text("Push: uitnodigingen en toegang", "Push: invitations and access")],
                ["pushTripUpdates", text("Push: reizen en Agency-werk", "Push: trips and Agency work")],
                ["pushPayments", text("Push: betalingen en verrekeningen", "Push: payments and settlements")],
                ["pushFlightAlerts", text("Push: vluchtwijzigingen", "Push: flight changes")],
                ["pushAccountService", text("Push: account en belangrijke serviceberichten", "Push: account and important service notices")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border p-3">
                <input
                  type="checkbox"
                  checked={communication[key]}
                  onChange={(event) =>
                    setCommunication((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Button
            type="button"
            disabled={savingCommunication}
            onClick={() => void saveCommunication()}
          >
            {savingCommunication
              ? text("Opslaan...", "Saving...")
              : text("Communicatie opslaan", "Save communication settings")}
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/40 surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4" /> Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="font-medium">
                {text("AVG-privacyverzoek indienen", "Submit a GDPR privacy request")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {text(
                  "Vraag om inzage, correctie, verwijdering, beperking, bezwaar of overdraagbaarheid. Het verzoek komt rechtstreeks in de beveiligde Corporate Admin-wachtrij.",
                  "Request access, correction, deletion, restriction, objection or portability. Your request goes directly to the protected Corporate Admin queue.",
                )}
              </p>
            </div>
            <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">{text("Privacyverzoek indienen", "Submit privacy request")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{text("Privacyverzoek indienen", "Submit privacy request")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={privacyType}
              onChange={(e) => setPrivacyType(e.target.value as typeof privacyType)}
            >
              <option value="access">{text("Inzage", "Access")}</option>
              <option value="correction">{text("Correctie", "Correction")}</option>
              <option value="deletion">{text("Verwijdering", "Deletion")}</option>
              <option value="restriction">{text("Beperking", "Restriction")}</option>
              <option value="objection">{text("Bezwaar", "Objection")}</option>
              <option value="portability">{text("Overdraagbaarheid", "Portability")}</option>
              <option value="other">{text("Anders", "Other")}</option>
            </select>
            <Textarea
              value={privacyNotes}
              maxLength={2000}
              onChange={(e) => setPrivacyNotes(e.target.value)}
              placeholder={text(
                "Beschrijf je verzoek (minimaal 10 tekens)",
                "Describe your request (at least 10 characters)",
              )}
            />
            <Button
              type="button"
              disabled={submittingPrivacy || privacyNotes.trim().length < 10}
              onClick={() => void sendPrivacyRequest()}
            >
              {submittingPrivacy
                ? text("Even geduld...", "Submitting...")
                : text("Privacyverzoek indienen", "Submit privacy request")}
            </Button>
                </div>
              </DialogContent>
            </Dialog>
            {(privacyRequests.data?.length ?? 0) > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {text("Mijn eerdere verzoeken", "My previous requests")}
                </p>
                {privacyRequests.data!.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs"
                  >
                    <span>{privacyTypeLabel(request.request_type, text)}</span>
                    <span className="rounded-full bg-muted px-2 py-1 font-medium">
                      {privacyStatusLabel(request.status, text)}
                    </span>
                    <span className="w-full text-muted-foreground">
                      {text("Ontvangen", "Received")}{" "}
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(request.received_at),
                      )}{" "}
                      {" / "}{" "}
                      {request.closed_at
                        ? text("Afgesloten", "Closed")
                        : `${text("Uiterlijk antwoord", "Response due")} ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(request.due_at))}`}
                    </span>
                    {request.response_text && (
                      <p className="w-full whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-foreground">
                        <strong>
                          {text("Antwoord van GlobeTrotr", "Response from GlobeTrotr")}
                        </strong>
                        <br />
                        {request.response_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {text("Browseropslag beheren", "Manage browser storage")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {text(
                  "Beheer taalopslag en optionele Google Analytics-tracking voor deze portal. Je kunt deze keuzes aanpassen of intrekken; weigeren beperkt je toegang niet.",
                  "Manage language storage and optional Google Analytics tracking for this portal. You can change or withdraw these choices; refusing does not restrict your access.",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={openPrivacyChoices}
            >
              {text("Privacykeuzes", "Privacy choices")}
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{text("Download je gegevens", "Download your data")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {text(
                  "Ontvang een machineleesbaar JSON-bestand met je account, profiel, reizen, planning, uitgaven en samenwerkingen. Geüploade bestanden worden als metadata vermeld.",
                  "Receive a machine-readable JSON file with your account, profile, trips, itinerary, expenses and collaborations. Uploaded files are listed as metadata.",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={exporting}
              onClick={() => void downloadAccountExport()}
            >
              <Download className="size-4" />{" "}
              {exporting
                ? text("Export maken...", "Creating export...")
                : text("Gegevens exporteren", "Export data")}
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-destructive">
                {text("Account definitief verwijderen", "Permanently delete account")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {text(
                  "Je profiel, eigen reizen, uitgaven, meldingen en uploads worden verwijderd. Dit kan niet ongedaan worden gemaakt.",
                  "Your profile, owned trips, expenses, notifications and uploads will be deleted. This cannot be undone.",
                )}
              </p>
            </div>
            <AlertDialog onOpenChange={(open) => !open && setDeleteConfirmation("")}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="shrink-0">
                  <Trash2 className="size-4" /> {text("Account verwijderen", "Delete account")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>{text("Weet je het zeker?", "Are you sure?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {text(
                      "Download desgewenst eerst je gegevens. Typ DELETE om je account en alle eigen reisgegevens definitief te verwijderen.",
                      "Download your data first if you wish. Type DELETE to permanently remove your account and all trips you own.",
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  aria-label={text("Bevestiging", "Confirmation")}
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    {text("Annuleren", "Cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteConfirmation !== "DELETE" || deleting}
                    onClick={(event) => {
                      event.preventDefault();
                      void removeAccount();
                    }}
                  >
                    {deleting
                      ? text("Verwijderen...", "Deleting...")
                      : text("Definitief verwijderen", "Delete permanently")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function providerLabel(provider: string) {
  return OAUTH_PROVIDERS.find((option) => option.id === provider)?.label ?? provider;
}

function privacyTypeLabel(value: string, text: (nl: string, en: string) => string) {
  return (
    {
      access: text("Inzage", "Access"),
      correction: text("Correctie", "Correction"),
      deletion: text("Verwijdering", "Deletion"),
      restriction: text("Beperking", "Restriction"),
      objection: text("Bezwaar", "Objection"),
      portability: text("Overdraagbaarheid", "Portability"),
      other: text("Anders", "Other"),
    }[value] ?? value
  );
}
function privacyStatusLabel(value: string, text: (nl: string, en: string) => string) {
  return (
    {
      received: text("Ontvangen", "Received"),
      verifying: text("Identiteit controleren", "Verifying identity"),
      processing: text("In behandeling", "Processing"),
      completed: text("Afgerond", "Completed"),
      rejected: text("Afgewezen", "Rejected"),
    }[value] ?? value
  );
}
