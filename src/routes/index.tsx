import { HomeInsights } from "@/components/HomeInsights";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { MarketingClosing } from "@/components/MarketingClosing";
import { MarketingMotion } from "@/components/MarketingMotion";
import { marketingHead } from "@/lib/marketing-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Route as RouteIcon, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { JourneyScene } from "@/components/JourneyScene";
import { listPublicTestimonials } from "@/lib/testimonials.functions";
import { portalUrl } from "@/lib/site-routing";
import { GLOBETROTR_SLOGAN } from "@/lib/branding";
import { PUBLIC_SITE_STRUCTURED_DATA } from "@/lib/public-site-seo";

export const Route = createFileRoute("/")({
  head: () => marketingHead("/", "nl-NL"),
  component: Landing,
});

export function Landing() {
  const { user } = useAuth();
  const { text } = useLocale();
  const testimonials = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: listPublicTestimonials,
    staleTime: 300_000,
  });
  const startLabel = user
    ? text("Open mijn reizen", "Open my trips")
    : text("Start gratis", "Start for free");

  return (
    <MarketingMotion className="marketing-page homepage space-y-12 pb-8 sm:space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(PUBLIC_SITE_STRUCTURED_DATA),
        }}
      />
      <section className="marketing-hero home-hero relative px-5 py-8 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
        <div className="relative grid items-center gap-10 xl:grid-cols-[.9fr_1.1fr]">
          <div>
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <Sparkles className="size-3.5" />
              {text("Gebouwd voor echte groepsreizen", "Built for real group trips")}
            </Badge>
            <h1 className="max-w-2xl font-display text-3xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
              {text("Jullie hele rondreis,", "Your whole trip,")}{" "}
              <span className="home-heading-teal">
                {text("samen geregeld", "planned together")}
              </span>{" "}
              <span className="home-heading-sunset">{text("op één plek.", "in one place.")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90 sm:text-lg">
              {text(
                "GlobeTrotr brengt route, boekingen, dagplanning, paklijst, groepskosten en herinneringen samen. Iedereen weet waar de reis staat en bewaart daarna ook het verhaal.",
                "GlobeTrotr brings routes, bookings, itineraries, packing, group expenses and memories together. Everyone knows where the trip stands and keeps the story afterwards too.",
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
                <a href={portalUrl(user ? "/dashboard" : "/register")}>
                  {startLabel}
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Link
                to="/demo"
                className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground underline underline-offset-4 hover:text-primary sm:px-2"
              >
                {text("Eerst even rondkijken? Bekijk de demo", "Want a look first? View the demo")}
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs opacity-80">
              {[
                text("Gratis starten", "Free to start"),
                text("Privé als standaard", "Private by default"),
                text("Nederlands en Engels", "Dutch and English"),
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="size-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <JourneyScene />
          </div>
        </div>
      </section>

      <HomeInsights />

      <section className="home-audiences">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline">{text("Kies hoe je reist", "Choose how you travel")}</Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            {text(
              "Eén planner voor jezelf én voor de hele groep",
              "One planner for yourself and for the whole group",
            )}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {text(
              "Begin alleen en nodig later mensen uit, of bouw direct samen. Rollen houden planning, geld en alleen-lezen toegang duidelijk gescheiden.",
              "Start alone and invite people later, or build together immediately. Roles keep planning, money and view-only access clearly separated.",
            )}
          </p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card className="marketing-editorial-card marketing-choice">
            <CardContent className="p-5 sm:p-7">
              <RouteIcon className="size-7 text-primary" />
              <h3 className="mt-4 font-display text-2xl font-semibold">
                {text("Mijn reis", "My trip")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {text(
                  "Plan route, boekingen, hotels, huurauto, kosten, offline informatie en herinneringen in één persoonlijk overzicht.",
                  "Plan routes, bookings, hotels, rental cars, expenses, offline information and memories in one personal overview.",
                )}
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/for-travelers">
                  {text("Voor individuele reizigers", "For individual travellers")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="marketing-editorial-card marketing-editorial-card--group marketing-choice marketing-choice--group">
            <CardContent className="p-5 sm:p-7">
              <Users className="size-7 text-primary" />
              <h3 className="mt-4 font-display text-2xl font-semibold">
                {text("Onze groepsreis", "Our group trip")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {text(
                  "Nodig iedereen tegelijk uit, verdeel rollen en taken, maak persoonlijke en gezamenlijke paklijsten, vergelijk opties, stem en verreken groepskosten eerlijk.",
                  "Invite everyone at once, assign roles and tasks, create personal and shared packing lists, compare options, vote and settle group expenses fairly.",
                )}
              </p>
              <Button asChild className="mt-5">
                <Link to="/for-groups">
                  {text("Ontdek groepsreizen", "Explore group travel")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold">
            {text("Je eerste reis begint gratis", "Your first trip starts for free")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text(
              "Twee actieve reizen, samen plannen en kosten verdelen zijn inbegrepen. Bekijk Pro voor extra reisruimte of Agency voor professioneel klantbeheer.",
              "Two active trips, planning together and splitting expenses are included. Explore Pro for more room to travel or Agency for professional client management.",
            )}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 self-start lg:self-auto">
          <Link to="/pricing">
            {text("Bekijk de abonnementen", "View plans")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      {(testimonials.data?.length ?? 0) > 0 && (
        <section>
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">{text("Ervaringen", "Testimonials")}</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold">
              {text("Wat reizigers over GlobeTrotr zeggen", "What travellers say about GlobeTrotr")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {text(
                "Deze citaten worden door ons beheer geselecteerd en gepubliceerd. Dit is geen volledig overzicht van beoordelingen; aankoop of gebruik wordt niet automatisch geverifieerd.",
                "These quotes are selected and published by our administrators. This is not a complete review overview; purchase or use is not automatically verified.",
              )}
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {testimonials.data!.slice(0, 3).map((review) => (
              <Card key={review.id} className="marketing-editorial-card">
                <CardContent className="p-6">
                  {review.rating && (
                    <div
                      className="mb-4 flex gap-1 text-amber-500"
                      aria-label={`${review.rating}/5`}
                    >
                      {Array.from({ length: review.rating }, (_, i) => (
                        <span key={i}>★</span>
                      ))}
                    </div>
                  )}
                  <blockquote className="leading-relaxed">
                    “{text(review.quoteNl, review.quoteEn)}”
                  </blockquote>
                  <p className="mt-5 font-semibold">{review.authorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {text(review.authorContextNl, review.authorContextEn)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid items-center gap-6 lg:grid-cols-[.72fr_1.28fr] lg:gap-12">
        <div className="relative min-h-96 overflow-hidden rounded-t-[8rem] rounded-b-3xl">
          <img
            src="/about/domenic-founder-web.jpg"
            alt={text("Domenic, oprichter van GlobeTrotr", "Domenic, founder of GlobeTrotr")}
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        <div className="p-7 sm:p-10">
          <Badge variant="secondary">
            {text("Ontstaan tijdens een echte reis", "Created while planning a real trip")}
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold">
            {text(
              "Van spreadsheet-hel naar een droomreis door Zweden",
              "From spreadsheet hell to a dream trip through Sweden",
            )}
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {text(
              "Ik bouwde GlobeTrotr toen vluchtbevestigingen, hoteladressen, routes en groepskosten voor mijn eigen reis overal verspreid stonden. Reizen hoort om vrijheid en voorpret te draaien, niet om administratie.",
              "I built GlobeTrotr when flight confirmations, hotel addresses, routes and group expenses for my own trip were scattered everywhere. Travel should be about freedom and anticipation, not administration.",
            )}
          </p>
          <p className="mt-4 font-medium">
            — Domenic, {text("oprichter van GlobeTrotr", "founder of GlobeTrotr")}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/about">
              {text("Lees het hele verhaal", "Read the full story")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="home-trust-title" className="grid gap-5 rounded-3xl border bg-card/60 p-6 sm:p-9 lg:grid-cols-3">
        <div className="border-b pb-6 lg:col-span-3">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2 id="home-trust-title" className="font-display text-2xl font-semibold">
                {text("Jouw reisplannen verdienen goede bescherming.", "Your travel plans deserve good protection.")}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {text(
                  "GlobeTrotr is onderzocht op beveiligingsrisico's. Toegangscontroles en gegevensbescherming zijn aangescherpt en getest. Ook zijn de code en afhankelijkheden gescand op bekende beveiligingsrisico's.",
                  "GlobeTrotr has been reviewed for security risks. Access controls and data protection have been strengthened and tested. The code and dependencies have also been scanned for known security risks.",
                )}
              </p>
              <ul className="mt-4 flex flex-col gap-x-6 gap-y-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap">
                {[
                  text("Security-audit uitgevoerd", "Security audit completed"),
                  text("Toegangsbeveiliging gecontroleerd", "Access controls reviewed"),
                  text("Code en afhankelijkheden gescand", "Code and dependencies scanned"),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <h3 className="font-semibold">
            {text("Je reisdata blijft dichtbij", "Your trip data stays close")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {text(
              "Primaire account-, reis- en documentgegevens worden opgeslagen in de Europese Unie.",
              "Primary account, trip and document data is stored in the European Union.",
            )}
          </p>
        </div>
        <div className="rounded-2xl border p-5">
          <p className="font-semibold">
            {text("Europese infrastructuur", "European infrastructure")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {text(
              "Supabase in een Europese projectregio en GlobeTrotr-servers in Duitsland.",
              "Supabase in a European project region and GlobeTrotr servers in Germany.",
            )}
          </p>
        </div>
        <div className="rounded-2xl border p-5">
          <p className="font-semibold">{text("Jij houdt controle", "You stay in control")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {text(
              "Exporteer of verwijder je gegevens en kies later zelf welke optionele koppelingen je activeert.",
              "Export or delete your data and choose which optional connections you activate later.",
            )}
          </p>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link to="/privacy">
              {text("Lees hoe privacy werkt", "Read how privacy works")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <MarketingClosing
        title={["Maak van reischaos weer voorpret", "Turn travel chaos back into anticipation"]}
        description={[
          "Start met een gratis account. Je reis blijft privé totdat jij besluit iets te delen.",
          "Start with a free account. Your trip stays private until you choose to share it.",
        ]}
      />
    </MarketingMotion>
  );
}
