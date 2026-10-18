import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookHeart,
  BriefcaseBusiness,
  Check,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { JourneyScene } from "@/components/JourneyScene";
import { PublicPlanOverview } from "@/components/PublicPlanOverview";
import { listPublicTestimonials } from "@/lib/testimonials.functions";
import { portalUrl } from "@/lib/site-routing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reisplanner voor jouw vakantie en groepsreis — GlobeTrotr" },
      {
        name: "description",
        content:
          "Plan routes, boekingen, dagprogramma en groepskosten samen en bewaar je reis in een compleet dagboek.",
      },
      { property: "og:title", content: "GlobeTrotr — Je hele reis in één overzicht" },
      {
        property: "og:description",
        content:
          "Van eerste route tot laatste betaalverzoek: plan de reis samen en houd grip op ieder detail.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/" }],
  }),
  component: Landing,
});

function Landing() {
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
  const journey = [
    {
      icon: RouteIcon,
      number: "01",
      title: text("Bouw samen de route", "Build the route together"),
      body: text(
        "Zet stops in de juiste volgorde, bekijk ze op de kaart en houd reisdagen overzichtelijk.",
        "Order stops, see them on the map and keep travel days clear.",
      ),
    },
    {
      icon: BriefcaseBusiness,
      number: "02",
      title: text("Leg plannen en boekingen vast", "Capture plans and bookings"),
      body: text(
        "Bewaar verblijf, vervoer en activiteiten naast het dagprogramma, zonder te zoeken in chats en inboxen.",
        "Keep accommodation, transport and activities beside the itinerary without searching chats and inboxes.",
      ),
    },
    {
      icon: WalletCards,
      number: "03",
      title: text("Verdeel kosten zonder gedoe", "Split expenses without hassle"),
      body: text(
        "Registreer wie betaalde en laat de slimme verrekening het kleinste aantal terugbetalingen voorstellen.",
        "Record who paid and let smart settlement propose the fewest repayments.",
      ),
    },
    {
      icon: BookHeart,
      number: "04",
      title: text("Bewaar het verhaal van je reis", "Keep the story of your trip"),
      body: text(
        "Leg herinneringen vast, lees ze offline terug en deel alleen wat jij bewust openbaar maakt via een directe reislink of je eigen reizigersprofiel.",
        "Capture memories, revisit them offline and only share what you deliberately make public through a direct trip link or your own traveller profile.",
      ),
    },
  ];

  return (
    <div className="marketing-page homepage space-y-12 pb-8 sm:space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "GlobeTrotr",
            applicationCategory: "TravelApplication",
            operatingSystem: "Web",
            url: "https://globetrotr.nl/",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          }),
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
              {text("Plan de reis.", "Plan the trip.")}{" "}
              <span className="home-heading-teal">{text("Deel de details.", "Share the details.")}</span>{" "}
              <span className="home-heading-sunset">{text("Verreken eerlijk.", "Settle fairly.")}</span>
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
              <Link to="/demo" className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground underline underline-offset-4 hover:text-primary sm:px-2">
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

      <section className="home-comparison grid overflow-hidden lg:grid-cols-2">
        <div className="bg-muted/40 p-5 sm:p-9">
          <Badge variant="outline">{text("Zonder GlobeTrotr", "Without GlobeTrotr")}</Badge>
          <h2 className="mt-4 font-display text-2xl font-semibold">
            {text("Zoeken, doorsturen en opnieuw uitrekenen", "Search, forward and recalculate")}
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            {[
              text(
                "Boekingen verspreid over mailboxen en chats",
                "Bookings scattered across inboxes and chats",
              ),
              text(
                "Niemand weet welke planning actueel is",
                "Nobody knows which itinerary is current",
              ),
              text(
                "Handmatig uitzoeken wie nog aan wie betaalt",
                "Manually work out who still owes whom",
              ),
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="text-destructive">×</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-primary/5 p-5 sm:p-9">
          <Badge>{text("Met GlobeTrotr", "With GlobeTrotr")}</Badge>
          <h2 className="mt-4 font-display text-2xl font-semibold">
            {text(
              "Eén actuele reis die iedereen begrijpt",
              "One current trip everyone understands",
            )}
          </h2>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              text(
                "Route, boekingen en dagplanning bij elkaar",
                "Routes, bookings and itinerary together",
              ),
              text(
                "Iedereen ziet wat bij zijn of haar rol past",
                "Everyone sees what fits their role",
              ),
              text(
                "Slimme verrekening maakt betalen concreet",
                "Smart settlement makes repayments clear",
              ),
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-7">
            <Link to="/features">
              {text("Bekijk de mogelijkheden", "Explore the features")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
      <section className="home-journey">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">{text("Eén doorlopende reis", "One connected journey")}</Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            {text("Van eerste idee tot thuiskomst", "From first idea to coming home")}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {text(
              "Geen verzameling losse hulpmiddelen, maar één reis die met jullie plannen meegroeit.",
              "A single trip that grows with your plans instead of disconnected tools.",
            )}
          </p>
        </div>
        <div className="marketing-journey mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {journey.map(({ icon: Icon, number, title, body }) => (
            <Card key={number} className="marketing-editorial-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-3xl text-muted-foreground/35">{number}</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="home-plans"><PublicPlanOverview compact /></div>

      <section className="home-agency grid gap-5 rounded-3xl border p-6 sm:p-9 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div>
          <Badge variant="secondary">
            <Users className="mr-1 size-3" />
            {text("Voor reizigers én reisprofessionals", "For travellers and travel professionals")}
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold">
            {text(
              "Dezelfde heldere reis, met toegang die bij je rol past",
              "The same clear trip, with access that fits your role",
            )}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {text(
              "Reisgenoten werken samen aan planning en kosten. Agencies beheren daarnaast klanten, offertes, taken, leveranciers en hun eigen huisstijl vanuit een aparte werkplek.",
              "Travellers collaborate on plans and expenses. Agencies also manage clients, quotes, tasks, suppliers and their own branding from a dedicated workspace.",
            )}
          </p>
        </div>
        <div className="grid gap-3">
          <Button asChild variant="outline" className="h-auto justify-between p-4">
            <Link to="/for-groups">
              {text("Bekijk groepsreizen", "Explore group travel")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto justify-between p-4">
            <Link to="/for-agencies">
              {text("Ontdek GlobeTrotr Agency", "Discover GlobeTrotr Agency")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {(testimonials.data?.length ?? 0) > 0 && (
        <section>
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">{text("Ervaringen", "Testimonials")}</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold">
              {text("Wat reizigers over GlobeTrotr zeggen", "What travellers say about GlobeTrotr")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{text("Deze citaten worden door ons beheer geselecteerd en gepubliceerd. Dit is geen volledig overzicht van beoordelingen; aankoop of gebruik wordt niet automatisch geverifieerd.", "These quotes are selected and published by our administrators. This is not a complete review overview; purchase or use is not automatically verified.")}</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {testimonials.data!.slice(0, 6).map((review) => (
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

      <section className="home-next rounded-3xl px-6 py-8 sm:px-9">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <Badge variant="secondary">{text("Samen op reis", "Travel together")}</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold">
              {text(
                "Minder afstemmen, meer genieten",
                "Less coordinating, more enjoying",
              )}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {text(
                "Verzamel ideeën, kies samen waar je heen gaat en verdeel de kosten. Met de planning, boekingen en paklijst bij elkaar weet iedereen wat er geregeld is. Onderweg groeit je dagboek mee met de reis.",
                "Collect ideas, choose where to go together and split the costs. With plans, bookings and packing lists together, everyone knows what is arranged. On the road, your journal grows with your trip.",
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/for-groups">
              {text("Ontdek groepsreizen", "Explore group trips")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

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

      <section className="grid gap-5 rounded-3xl border bg-card/60 p-6 sm:p-9 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ShieldCheck className="size-7 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">
            {text("Je reisdata blijft dichtbij", "Your trip data stays close")}
          </h2>
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

      <section className="marketing-invitation px-6 py-12 text-center sm:px-10 sm:py-16">
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-semibold">
          {text("Maak van reischaos weer voorpret", "Turn travel chaos back into anticipation")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm opacity-85">
          {text(
            "Start met een gratis account. Je reis blijft privé totdat jij besluit iets te delen.",
            "Start with a free account. Your trip stays private until you choose to share it.",
          )}
        </p>
        <Button asChild size="lg" className="mt-7">
          <a href={portalUrl(user ? "/dashboard" : "/register")}>
            {startLabel}
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </section>
    </div>
  );
}
