import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Globe2, Settings2, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { staffLoginRequired } from "@/lib/staff-account-access";

export const Route = createFileRoute("/complete-profile")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await supabase.auth.getUser();
    const destination = `${location.pathname}${location.searchStr}${location.hash}`;
    if (!user.data.user) throw redirect({ to: "/auth", search: { redirect: destination } });
    if (staffLoginRequired(await getStaffSecurityStatus())) throw redirect({ to: "/team-login", search: { redirect: destination } });
  },
  validateSearch: (search: Record<string, unknown>) => ({ next: safeInternalRedirect(search.next) || "/dashboard" }),
  component: CompleteProfile,
});

const TIMEZONES = ["Europe/Amsterdam", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "UTC"];

function CompleteProfile() {
  const { user, loading } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { text, locale, setLocale } = useLocale();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(String(user?.user_metadata?.full_name || ""));
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [language, setLanguage] = useState(locale === "en-GB" ? "en-GB" : "nl-NL");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
  const [theme, setTheme] = useState("system");
  const [slug, setSlug] = useState("");
  const [biography, setBiography] = useState("");
  const [publicProfile, setPublicProfile] = useState(false);
  const [friendRequests, setFriendRequests] = useState(true);
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!user) return;
    const normalizedSlug = slug.trim().toLowerCase();
    if (!name.trim()) { toast.error(text("Vul je naam in.", "Enter your name.")); setStep(0); return; }
    if (publicProfile && !/^[a-z0-9][a-z0-9-]{2,39}$/.test(normalizedSlug)) { toast.error(text("Kies een geldige profielnaam van 3 tot 40 tekens.", "Choose a valid username of 3 to 40 characters.")); return; }
    setBusy(true);
    try {
      let avatarPath: string | undefined;
      if (photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) throw new Error(text("Kies een JPG, PNG of WebP tot 5 MB.", "Choose a JPG, PNG or WebP under 5 MB."));
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        avatarPath = `${user.id}/avatar.${extension}`;
        const { error } = await supabase.storage.from("avatars").upload(avatarPath, photo, { upsert: true });
        if (error) throw error;
      }
      const profileValues = {
        id: user.id, display_name: name.trim(), email: user.email, phone: phone.trim() || null,
        locale: language, timezone, theme, public_slug: normalizedSlug || null,
        biography: biography.trim() || null, public_profile_enabled: publicProfile,
        friend_requests_enabled: friendRequests, ...(avatarPath ? { avatar_path: avatarPath } : {}),
        onboarding_completed_at: new Date().toISOString(),
      };
      let { error } = await supabase.from("profiles").upsert(profileValues as never);
      if (error?.message.includes("AGENCY_PUBLIC_PROFILE_UNAVAILABLE")) {
        ({ error } = await supabase.from("profiles").upsert({ ...profileValues, public_profile_enabled: false } as never));
        if (!error) toast.info(text("Je Agency-account is zonder openbaar reizigersprofiel ingesteld.", "Your Agency account was set up without a public traveler profile."));
      }
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: name.trim(), phone: phone.trim() || null, language: language.startsWith("nl") ? "nl" : "en" } });
      setLocale(language as "nl-NL" | "en-GB");
      window.location.assign(next);
    } catch (error) { toast.error(error instanceof Error ? error.message : text("Opslaan is mislukt.", "Could not save your profile.")); }
    finally { setBusy(false); }
  }

  if (loading) return null;
  if (!user) { void navigate({ to: "/auth", replace: true }); return null; }
  const steps = [[UserRound, text("Gegevens", "Details")], [Settings2, text("Instellingen", "Settings")], [Globe2, text("Profiel", "Profile")]] as const;
  return <main className="mx-auto max-w-2xl px-4 py-10"><Card className="shadow-xl">
    <CardHeader><Badge className="w-fit">{text("Eenmalige accountsetup", "One-time account setup")}</Badge><CardTitle className="mt-2 text-2xl">{text("Welkom bij GlobeTrotr", "Welcome to GlobeTrotr")}</CardTitle><p className="text-sm text-muted-foreground">{text("Stel je gegevens, voorkeuren en optionele openbare profiel in. Alles kan later onder Account worden gewijzigd.", "Set your details, preferences and optional public profile. Everything can be changed later under Account.")}</p><div className="grid grid-cols-3 gap-2 pt-3">{steps.map(([Icon,label],index)=><div key={label} className={`rounded-xl border p-3 text-center text-xs ${index===step?"border-primary bg-primary/5":""}`}><Icon className="mx-auto mb-1 size-4"/>{index+1}. {label}</div>)}</div></CardHeader>
    <CardContent className="space-y-5">
      {step===0&&<><Field label={text("Naam","Name")} id="setup-name"><Input id="setup-name" autoComplete="name" maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></Field><Field label={text("Telefoonnummer (optioneel)","Phone number (optional)")} id="setup-phone"><Input id="setup-phone" type="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)}/></Field><Field label={text("Profielfoto (optioneel)","Profile photo (optional)")} id="setup-photo"><Input id="setup-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPhoto(event.target.files?.[0]||null)}/></Field></>}
      {step===1&&<><Field label={text("Taal","Language")} id="setup-language"><select id="setup-language" className="w-full rounded-md border bg-background px-3 py-2" value={language} onChange={event=>setLanguage(event.target.value)}><option value="nl-NL">Nederlands</option><option value="en-GB">English</option></select></Field><Field label={text("Tijdzone","Time zone")} id="setup-timezone"><select id="setup-timezone" className="w-full rounded-md border bg-background px-3 py-2" value={timezone} onChange={event=>setTimezone(event.target.value)}>{TIMEZONES.map(value=><option key={value}>{value}</option>)}</select></Field><Field label={text("Weergave","Appearance")} id="setup-theme"><select id="setup-theme" className="w-full rounded-md border bg-background px-3 py-2" value={theme} onChange={event=>setTheme(event.target.value)}><option value="system">{text("Systeeminstelling","System setting")}</option><option value="light">{text("Licht","Light")}</option><option value="dark">{text("Donker","Dark")}</option></select></Field></>}
      {step===2&&<><Toggle label={text("Openbaar reizigersprofiel","Public traveller profile")} description={text("Standaard uit. Alleen bewuste profielinformatie en openbare reizen worden getoond.","Off by default. Only deliberate profile information and public trips are shown.")} checked={publicProfile} onChange={setPublicProfile}/>{publicProfile&&<><Field label={text("Unieke profielnaam","Unique username")} id="setup-slug"><Input id="setup-slug" value={slug} maxLength={40} onChange={event=>setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} placeholder="noor-op-reis"/><p className="text-xs text-muted-foreground">portal.globetrotr.nl/users/{slug||"jouw-naam"}</p></Field><Field label={text("Biografie","Biography")} id="setup-bio"><Textarea id="setup-bio" value={biography} maxLength={500} onChange={event=>setBiography(event.target.value)}/><p className="text-right text-xs text-muted-foreground">{biography.length}/500</p></Field><Toggle label={text("Vriendschapsverzoeken toestaan","Allow friend requests")} checked={friendRequests} onChange={setFriendRequests}/></>}</>}
      <div className="flex justify-between gap-2 border-t pt-4"><Button variant="ghost" disabled={step===0||busy} onClick={()=>setStep(value=>value-1)}><ChevronLeft className="size-4"/>{text("Vorige","Previous")}</Button>{step<2?<Button disabled={step===0&&!name.trim()} onClick={()=>setStep(value=>value+1)}>{text("Verder","Continue")}<ChevronRight className="size-4"/></Button>:<Button disabled={busy} onClick={()=>void finish()}><Check className="size-4"/>{busy?text("Opslaan…","Saving…"):text("Setup afronden","Complete setup")}</Button>}</div>
    </CardContent>
  </Card></main>;
}

function Field({label,id,children}:{label:string;id:string;children:ReactNode}) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function Toggle({label,description,checked,onChange}:{label:string;description?:string;checked:boolean;onChange:(value:boolean)=>void}) { return <div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><Label>{label}</Label>{description&&<p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div><Switch checked={checked} onCheckedChange={onChange}/></div>; }
