import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { usePublicRumSettings } from "@/lib/use-public-rum-settings";
import { startPublicRum } from "@/lib/public-performance-runtime";
import { useLocale } from "@/lib/locale";
import { Switch } from "@/components/ui/switch";

export function PublicPerformance() {
  const settings = usePublicRumSettings();
  const router = useRouter();
  useEffect(() => {
    // The runtime deliberately lives for the full document, including StrictMode
    // effect replay. Its own navigation/choice guards shut it down permanently.
    startPublicRum(settings, check => { router.history.subscribe(check); });
  }, [settings, router]);
  return null;
}

export function PublicPerformanceChoice({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { text } = useLocale();
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3">
    <div><p className="text-sm font-medium">{text("Snelheidsmetingen · Cloudflare", "Performance measurements · Cloudflare")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text(
        "Help ons de openbare website sneller te maken. Cloudflare ontvangt browsergegevens, het openbare paginapad, herkende pagina-elementen en laad-, interactie- en layoutmetingen. Alleen vaste informatiepagina’s; geen reizen, postvakken of formulieren. Verwerking kan buiten de EER plaatsvinden. Deze aparte keuze geldt 180 dagen voor deze browser op de website en wordt niet aan je account gekoppeld. Weigeren verandert je toegang niet.",
        "Help us make the public website faster. Cloudflare receives browser data, the public page path, identified page elements, and loading, interaction and layout measurements. Only fixed information pages; no trips, mailboxes or forms. Processing may take place outside the EEA. This separate choice applies for 180 days to this browser on the website and is not linked to your account. Refusing does not affect your access.",
      )}</p></div>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={text("Cloudflare-snelheidsmetingen toestaan", "Allow Cloudflare performance measurements")} />
  </label>;
}
