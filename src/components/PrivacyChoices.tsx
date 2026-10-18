import { useEffect, useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/lib/locale";
import { useAuth } from "@/lib/auth";
import { readPrivacyChoice } from "@/lib/privacy-consent";
import { publicSiteUrl } from "@/lib/site-routing";
import { analyticsPage, readAnalyticsChoice } from "@/lib/analytics";
import { usePrivacySync } from "@/lib/privacy-sync-context";
import { useRouterState } from "@tanstack/react-router";

export function PrivacyChoices() {
  const { ready, save } = usePrivacySync();
  const { text } = useLocale();
  const { user } = useAuth();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = readPrivacyChoice();
    setPreferences(saved?.preferences ?? false);
    setAnalytics(readAnalyticsChoice() === true);
    const publicPage = analyticsPage(window.location.hostname, window.location.pathname, window.location.search, window.location.hash);
    setOpen(ready && (Boolean(publicPage && readAnalyticsChoice() === null) || (!saved && !user)));
    const reopen = () => {
      setPreferences(readPrivacyChoice()?.preferences ?? false);
      setAnalytics(readAnalyticsChoice() === true);
      setOpen(true);
    };
    window.addEventListener("globetrotr:open-privacy-choices", reopen);
    const synced = () => { setPreferences(readPrivacyChoice()?.preferences ?? false); setAnalytics(readAnalyticsChoice() === true); };
    window.addEventListener("globetrotr:privacy-synced", synced);
    return () => { window.removeEventListener("globetrotr:open-privacy-choices", reopen); window.removeEventListener("globetrotr:privacy-synced", synced); };
  }, [ready, user, path]);

  if (!open) return null;
  const apply = async (allowPreferences: boolean, allowAnalytics: boolean) => {
    if (saving) return;
    setSaving(true);
    try { await save(allowPreferences, allowAnalytics); setOpen(false); }
    finally { setSaving(false); }
  };

  return (
    <section className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-2xl flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:bottom-5" role="dialog" aria-modal="false" aria-labelledby="privacy-choice-title">
      <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Cookie className="size-5" /></span>
        <div>
          <h2 id="privacy-choice-title" className="font-display text-lg font-semibold">{text("Cookies en privacykeuzes", "Cookies and privacy choices")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text("We gebruiken noodzakelijke cookies en browseropslag om de dienst te laten werken. Met jouw toestemming gebruiken we ook Google Analytics om bezoeken en acties te meten: dat is optionele tracking. Kies hieronder apart voor taalopslag en Analytics. Weigeren heeft geen gevolgen voor je toegang. Je keuze geldt op website en portal; na inloggen bewaren we die ook bij je account.", "We use necessary cookies and browser storage to operate the service. With your consent we also use Google Analytics to measure visits and actions: this is optional tracking. Choose language storage and Analytics separately below. Refusing does not affect your access. Your choice applies to both website and portal; after sign-in we also store it with your account.")}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-3"><div><p className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="size-4 text-primary" />{text("Noodzakelijk", "Necessary")}</p><p className="mt-1 text-xs text-muted-foreground">{text("Inlogsessie, beveiliging, lokale herstelcache, basisweergave en je privacykeuze.", "Sign-in session, security, local recovery cache, basic appearance and your privacy choice.")}</p></div><span className="text-xs font-semibold text-primary">{text("Altijd aan", "Always on")}</span></div>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3"><div><p className="text-sm font-medium">{text("Voorkeuren", "Preferences")}</p><p className="mt-1 text-xs text-muted-foreground">{text("Onthoud de gekozen taal op dit apparaat.", "Remember the selected language on this device.")}</p></div><Switch checked={preferences} onCheckedChange={setPreferences} aria-label={text("Voorkeursopslag toestaan", "Allow preference storage")} /></label>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3"><div><p className="text-sm font-medium">{text("Statistieken · Google Analytics", "Statistics · Google Analytics")}</p><p className="mt-1 text-xs text-muted-foreground">{text("Google ontvangt technische browsergegevens, je IP-adres voor technische verwerking, cookie-identificatoren en vaste acties zoals demogebruik of een reis aanmaken. Cookies blijven maximaal één jaar bewaard. Geen reisinhoud, formulierinhoud of meting van postvakken. Google kan gegevens buiten de EER verwerken. Alleen aan als je toestemming geeft; ook voor Pro en Agency vrijwillig.", "Google receives technical browser information, your IP address for technical processing, cookie identifiers and fixed actions such as using the demo or creating a trip. Cookies are retained for at most one year. No trip contents, form contents or mailbox measurement. Google may process data outside the EEA. Enabled only with your consent; also voluntary for Pro and Agency.")}</p></div><Switch checked={analytics} onCheckedChange={setAnalytics} aria-label={text("Google Analytics toestaan", "Allow Google Analytics")} /></label>
      </div>
      <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{text("Een offline reispakket of offline dagboek bewaar je alleen via een bewuste actie bij de reis of in het dagboek. Alleen zelf gekozen dagboekfoto's worden lokaal opgeslagen. Browserpush activeer je apart via een browsertoestemming. Deze handelingen worden niet door de voorkeursschakelaar hierboven aangezet.", "You only save an offline trip pack or offline journal through an explicit action inside the trip or journal. Only journal photos you select are stored locally. Browser push is enabled separately through browser permission. The preference switch above does not enable any of these features.")}</div>
      <p className="mt-3 text-xs text-muted-foreground">{text("De knoppen hieronder wijzigen taalopslag en Analytics voor website en portal, en je account wanneer je bent ingelogd. Je kunt deze keuzes later aanpassen of intrekken via Privacykeuzes.", "The buttons below change language storage and Analytics for website and portal, and your account when signed in. You can change or withdraw these choices later through Privacy choices.")} <a href={publicSiteUrl("/privacy#browseropslag")} className="underline underline-offset-2">{text("Bekijk cookies en bewaartermijnen", "View cookies and retention periods")}</a>.</p>
      </div>
      <div className="grid shrink-0 gap-2 border-t bg-background p-4 sm:grid-cols-2 sm:px-6"><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => apply(false, false)}>{text("Alleen noodzakelijk", "Necessary only")}</Button><Button type="button" className="min-h-11" disabled={saving} onClick={() => apply(preferences, analytics)}>{text("Keuze opslaan", "Save choice")}</Button></div>
    </section>
  );
}
