import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { canBill, hasFeature } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLocale } from "@/lib/locale";
import { localizeTagline } from "@/lib/localized-values";

export const Route = createFileRoute("/_authenticated/branding")({
  head: () => ({
    meta: [
      { title: "White-label branding — GlobeTrotr" },
      {
        name: "description",
        content:
          "Geef de reisplanner je eigen merknaam, domein, tagline en accentkleur voor je agency.",
      },
      { property: "og:title", content: "White-label branding — GlobeTrotr" },
      {
        property: "og:description",
        content: "Custom branding voor touroperators en travel agencies.",
      },
    ],
  }),
  component: BrandingPage,
});

function BrandingPage() {
  const { locale, text } = useLocale();
  const { state, update } = useWorkspace();
  const allowed = hasFeature(state.plan, "white_label") && canBill(state.role);
  const b = state.branding;

  const set = (patch: Partial<typeof b>) =>
    update((s) => ({ ...s, branding: { ...s.branding, ...patch } }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">White-label & custom branding</h1>
        <p className="text-sm text-muted-foreground">
          {text("Lever het platform onder je eigen merk aan klanten en reizigers.", "Offer the platform to clients and travellers under your own brand.")}
        </p>
      </div>

      {!allowed && (
        <p className="flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          <Lock className="size-4" /> {text("White-label vereist het Agency-plan en de eigenaarsrol.", "White-label requires the Agency plan and owner role.")} {" "}
          <Link to="/billing" className="underline">
            {text("Bekijk plannen", "View plans")}
          </Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{text("Merkinstellingen", "Brand settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <label className="block">
              <span className="text-muted-foreground">{text("Merknaam", "Brand name")}</span>
              <Input
                className="mt-1"
                disabled={!allowed}
                value={b.brandName}
                onChange={(e) => set({ brandName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">{text("Domein / subdomein", "Domain / subdomain")}</span>
              <Input
                className="mt-1"
                disabled={!allowed}
                value={b.domain}
                onChange={(e) => set({ domain: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Tagline</span>
              <Input
                className="mt-1"
                disabled={!allowed}
                value={b.tagline}
                onChange={(e) => set({ tagline: e.target.value })}
              />
            </label>
            <div>
              <span className="text-muted-foreground">{text("Accentkleur", "Accent colour")} (hue {b.accent})</span>
              <Slider
                className="mt-3"
                disabled={!allowed}
                min={0}
                max={360}
                step={1}
                value={[b.accent]}
                onValueChange={(v) => set({ accent: v[0] ?? b.accent })}
              />
            </div>
            <Button disabled={!allowed} onClick={() => toast.success(text("Branding opgeslagen", "Branding saved"))}>
              {text("Opslaan", "Save")}
            </Button>
          </CardContent>
        </Card>

        <Card className="surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{text("Live voorbeeld", "Live preview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aurora rounded-2xl p-6">
              <p className="text-xs opacity-80">{b.domain}</p>
              <p className="font-display text-2xl font-semibold">{b.brandName}</p>
              <p className="mt-1 text-sm opacity-90">{localizeTagline(b.tagline, locale)}</p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">{text("Reisschema", "Itinerary")}</span>
                <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">{text("Declaraties", "Claims")}</span>
                <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">{text("Kaart", "Map")}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {text("De accentkleur werkt direct door in de hele app, exports en PDF-declaraties.", "The accent colour is applied throughout the app, exports and PDF claims.")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
