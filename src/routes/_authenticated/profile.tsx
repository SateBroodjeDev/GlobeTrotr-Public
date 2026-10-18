import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ExternalLink, HeartHandshake, Plus, Save, UserRound, X } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { countryCode, countryFlag, countryLabel, countryOptions } from "@/lib/countries";
import { useLocale } from "@/lib/locale";
import { planOf } from "@/lib/plans";
import { useWorkspace } from "@/lib/workspace";
import { syncStaffProfile } from "@/lib/staff-profile-sync.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profielinstellingen - GlobeTrotr" }] }),
  component: ProfileSettingsPage,
});

type ProfileSettings = {
  display_name: string | null;
  avatar_path: string | null;
  public_slug: string | null;
  biography: string | null;
  public_profile_enabled: boolean;
  friend_requests_enabled: boolean;
  visited_countries: string[];
};

const RESERVED_SLUGS = [
  "admin",
  "administrator",
  "api",
  "auth",
  "billing",
  "contact",
  "corp",
  "corporate-admin",
  "dashboard",
  "globetrotr",
  "help",
  "journal",
  "login",
  "privacy",
  "register",
  "root",
  "security",
  "status",
  "support",
  "trips",
  "users",
  "vrienden",
];

function ProfileSettingsPage() {
  const { user: authenticatedUser } = useAuth();
  const user = authenticatedUser!;
  const { state } = useWorkspace();
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const isAgencyAccount = planOf(state.plan).id === "agency";
  const profileQuery = useQuery({
    queryKey: ["profile-settings", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, avatar_path, public_slug, biography, public_profile_enabled, friend_requests_enabled, visited_countries",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileSettings | null;
    },
  });
  const profile = profileQuery.data;
  const [publicSlug, setPublicSlug] = useState("");
  const [biography, setBiography] = useState("");
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
  const [friendRequestsEnabled, setFriendRequestsEnabled] = useState(true);
  const [visitedCountries, setVisitedCountries] = useState<string[]>([]);
  const [countryDraft, setCountryDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  async function retryTeamSync() {
    setSyncing(true);
    try {
      const result = await syncStaffProfile();
      if (["synced", "unchanged"].includes(result.status)) toast.success(text("Teamprofiel gesynchroniseerd.", "Team profile synchronized."));
      else toast.warning(text("Je profiel blijft bewaard. Teamsynchronisatie is nog niet gelukt; vraag je beheerder om de koppeling te controleren.", "Your profile is preserved. Team synchronization has not succeeded; ask your administrator to check the connection."));
    } catch { toast.warning(text("Je profiel is bewaard, maar teamsynchronisatie is niet beschikbaar.", "Your profile is saved, but team synchronization is unavailable.")); }
    finally { setSyncing(false); }
  }

  useEffect(() => {
    setPublicSlug(profile?.public_slug ?? "");
    setBiography(profile?.biography ?? "");
    setPublicProfileEnabled(Boolean(profile?.public_profile_enabled));
    setFriendRequestsEnabled(profile?.friend_requests_enabled !== false);
    setVisitedCountries(profile?.visited_countries ?? []);
  }, [profile]);

  useEffect(() => {
    if (!profile?.avatar_path) {
      setAvatarUrl(undefined);
      return;
    }
    void supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 60 * 60)
      .then(({ data }) => setAvatarUrl(data?.signedUrl));
  }, [profile?.avatar_path]);

  const initials = (profile?.display_name || user.email || "G")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function addVisitedCountry() {
    const country = countryCode(countryDraft);
    if (!country) {
      toast.error(text("Vul een geldige landnaam in.", "Enter a valid country name."));
      return;
    }
    if (visitedCountries.includes(country)) {
      setCountryDraft("");
      return;
    }
    if (visitedCountries.length >= 100) {
      toast.error(
        text("Je kunt maximaal 100 landen toevoegen.", "You can add up to 100 countries."),
      );
      return;
    }
    setVisitedCountries((current) =>
      [...current, country].sort((a, b) =>
        countryLabel(a, locale).localeCompare(countryLabel(b, locale), locale),
      ),
    );
    setCountryDraft("");
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error(
        text("Kies een JPG, PNG of WebP tot 5 MB.", "Choose a JPG, PNG or WebP up to 5 MB."),
      );
      event.target.value = "";
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const avatarPath = `${user.id}/avatar.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_path: avatarPath });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-settings", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-theme", user.id] }),
      ]);
      toast.success(text("Profielfoto opgeslagen.", "Profile picture saved."));
      const teamSync = await syncStaffProfile().catch(() => ({ status: "failed" }));
      if (["failed", "not_configured", "needs_link"].includes(teamSync.status)) toast.warning(text("Je foto is bewaard in GlobeTrotr. Teamsynchronisatie is nog niet geslaagd; probeer opnieuw.", "Your photo is saved in GlobeTrotr. Team synchronization has not succeeded yet; retry."));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Uploaden is mislukt.", "Upload failed."),
      );
    } finally {
      event.target.value = "";
    }
  }

  async function saveProfile() {
    const normalizedSlug = publicSlug.trim().toLowerCase();
    if (
      !isAgencyAccount &&
      publicProfileEnabled &&
      (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(normalizedSlug) || RESERVED_SLUGS.includes(normalizedSlug))
    ) {
      toast.error(
        text(
          "Kies een profielnaam van 3–40 kleine letters, cijfers of streepjes.",
          "Choose a profile name of 3–40 lowercase letters, numbers or hyphens.",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        public_slug: normalizedSlug || null,
        biography: biography.trim() || null,
        public_profile_enabled: isAgencyAccount ? false : publicProfileEnabled,
        friend_requests_enabled: friendRequestsEnabled,
        visited_countries: visitedCountries,
      } as any);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-settings", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile-theme", user.id] }),
      ]);
      toast.success(text("Profielinstellingen opgeslagen.", "Profile settings saved."));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Opslaan is mislukt.", "Saving failed."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {text("Profielinstellingen", "Profile settings")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {text(
            "Beheer hoe je als reiziger zichtbaar bent en welke landen je deelt.",
            "Manage how you appear as a traveller and which countries you share.",
          )}
        </p>
      </div>
      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserRound className="size-4" />
            {text("Profiel", "Profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <label>
              <Button type="button" variant="outline" asChild>
                <span>
                  <Camera className="size-4" />
                  {text("Profielfoto wijzigen", "Change profile picture")}
                </span>
              </Button>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadAvatar}
              />
            </label>
          </div>
          <div className="space-y-3 rounded-xl border p-4">
            <div>
              <h2 className="font-medium">
                {text("Openbaar reizigersprofiel", "Public traveller profile")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAgencyAccount
                  ? text(
                      "Openbare profielen zijn niet beschikbaar binnen een Agency-workspace.",
                      "Public profiles are unavailable in an Agency workspace.",
                    )
                  : text(
                      "Kies zelf wat andere reizigers op je profiel zien.",
                      "Choose what other travellers can see on your profile.",
                    )}
              </p>
            </div>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">
                  {text("Profiel openbaar tonen", "Show profile publicly")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {text(
                    "Toon je bio, landen en bewust openbaar gemaakte reizen.",
                    "Show your bio, countries and deliberately public trips.",
                  )}
                </span>
              </span>
              <input
                type="checkbox"
                checked={!isAgencyAccount && publicProfileEnabled}
                disabled={isAgencyAccount}
                onChange={(event) => setPublicProfileEnabled(event.target.checked)}
                className="size-5 accent-primary disabled:opacity-50"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">
                  {text("Vriendschapsverzoeken toestaan", "Allow friend requests")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {text(
                    "Anderen kunnen je alleen een verzoek sturen wanneer dit aanstaat.",
                    "Others can only send you a request while this is enabled.",
                  )}
                </span>
              </span>
              <input
                type="checkbox"
                checked={friendRequestsEnabled}
                onChange={(event) => setFriendRequestsEnabled(event.target.checked)}
                className="size-5 accent-primary"
              />
            </label>
            <label className="block space-y-1.5">
              <Label htmlFor="public-profile-slug">
                {text("Publieke profielnaam", "Public profile name")}
              </Label>
              <Input
                id="public-profile-slug"
                value={publicSlug}
                maxLength={40}
                onChange={(event) =>
                  setPublicSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder={text("bijv. wereldreiziger", "e.g. world-traveller")}
              />
              <p className="text-xs text-muted-foreground">
                portal.globetrotr.nl/users/{publicSlug || text("jouw-naam", "your-name")}
              </p>
            </label>
            <label className="block space-y-1.5">
              <Label htmlFor="public-profile-bio">{text("Biografie", "Biography")}</Label>
              <Textarea
                id="public-profile-bio"
                value={biography}
                maxLength={500}
                onChange={(event) => setBiography(event.target.value)}
                placeholder={text(
                  "Vertel kort wat voor reiziger je bent…",
                  "Briefly describe what kind of traveller you are…",
                )}
              />
              <p className="text-right text-xs text-muted-foreground">{biography.length}/500</p>
            </label>
          </div>
          <div className="space-y-3 rounded-xl border p-4">
            <div>
              <h2 className="font-medium">{text("Bezochte landen", "Visited countries")}</h2>
              <p className="text-xs text-muted-foreground">
                {text(
                  "Landen uit openbare reizen worden automatisch aangevuld.",
                  "Countries from public trips are added automatically.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                list="profile-country-options"
                value={countryDraft}
                onChange={(event) => setCountryDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addVisitedCountry();
                  }
                }}
                placeholder={text("Typ om een land te zoeken…", "Type to search for a country…")}
              />
              <datalist id="profile-country-options">
                {countryOptions(locale)
                  .filter((option) => !visitedCountries.includes(option.code))
                  .map((option) => (
                    <option key={option.code} value={option.label}>
                      {option.code}
                    </option>
                  ))}
              </datalist>
              <Button
                type="button"
                variant="outline"
                disabled={!countryDraft}
                onClick={addVisitedCountry}
              >
                <Plus className="size-4" />
                {text("Toevoegen", "Add")}
              </Button>
            </div>
            {visitedCountries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {visitedCountries.map((country) => (
                  <span
                    key={country}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 py-1 pl-3 pr-1 text-sm"
                  >
                    <span>{countryLabel(country, locale)}</span>
                    <span aria-hidden>{countryFlag(country)}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-muted"
                      aria-label={text(`${country} verwijderen`, `Remove ${country}`)}
                      onClick={() =>
                        setVisitedCountries((current) => current.filter((item) => item !== country))
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {text(
                  "Je hebt nog geen landen toegevoegd.",
                  "You have not added any countries yet.",
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving || profileQuery.isLoading} onClick={saveProfile}>
              <Save className="size-4" />
              {saving ? text("Opslaan…", "Saving…") : text("Profiel opslaan", "Save profile")}
            </Button>
            {user.app_metadata?.corporate_admin === true && <Button variant="outline" disabled={syncing || saving} onClick={() => void retryTeamSync()}>
              {text("Teamprofiel synchroniseren", "Synchronize team profile")}
            </Button>}
            {profile?.public_profile_enabled && profile.public_slug && (
              <Button variant="outline" asChild>
                <Link to="/users/$username" params={{ username: profile.public_slug }}>
                  <ExternalLink className="size-4" />
                  {text("Openbaar profiel bekijken", "View public profile")}
                </Link>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link to="/vrienden">
                <HeartHandshake className="size-4" />
                {text("Vrienden beheren", "Manage friends")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
