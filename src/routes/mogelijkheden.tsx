import { MarketingLink as Link } from "@/components/MarketingLink";
import { MarketingMotion } from "@/components/MarketingMotion";
import { MarketingClosing } from "@/components/MarketingClosing";
import { FeatureIllustration } from "@/components/FeatureIllustration";
import { marketingHead } from "@/lib/marketing-head";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  BookHeart,
  CalendarRange,
  Check,
  FileInput,
  GitCompareArrows,
  Globe2,
  LocateFixed,
  MapPinned,
  Plane,
  Share2,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
  Waypoints,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { portalUrl } from "@/lib/site-routing";
export const Route = createFileRoute("/mogelijkheden")({
  head: () => marketingHead("/features", "nl-NL"),
  component: FeaturesPage,
});
const PHASES = [
  {
    icon: MapPinned,
    title: ["Bouw je route op de kaart", "Build your route on the map"],
    copy: [
      "Zoek plekken wereldwijd, bepaal de volgorde en geef per stop aankomstdatum en verblijfsduur op.",
      "Search places worldwide, set their order and add an arrival date and stay length to each stop.",
    ],
    points: [
      ["Interactieve routekaart", "Interactive route map"],
      ["Wereldwijde bestemmingszoeker", "Worldwide destination search"],
      ["Ondersteunde etappen openen in Google Maps", "Open supported stages in Google Maps"],
    ],
  },
  {
    icon: CalendarRange,
    title: ["Maak van ideeën een dagplanning", "Turn ideas into a daily itinerary"],
    copy: [
      "Combineer eigen plannen met vluchten, verblijf, vervoer en activiteiten in één tijdlijn.",
      "Combine your own plans with flights, accommodation, transport and activities in one timeline.",
    ],
    points: [
      ["Inklapbare dagen en filters", "Collapsible days and filters"],
      ["Afteller; live weer met Pro", "Countdown; live weather with Pro"],
      ["Notities bij elk onderdeel", "Notes for every item"],
    ],
  },
  {
    icon: Plane,
    title: ["Bewaar boekingen waar je ze nodig hebt", "Keep bookings where you need them"],
    copy: [
      "Vluchtnummers, tijden, locaties, aanbieders en boekingsreferenties reizen mee in je overzicht.",
      "Flight numbers, times, locations, providers and booking references travel with your itinerary.",
    ],
    points: [
      [
        "Datumgebonden vluchtvoorstel via AeroDataBox",
        "Date-specific AeroDataBox flight suggestion",
      ],
      [
        "Booking.com-zoeken voor verblijf en huurauto",
        "Booking.com search for stays and rental cars",
      ],
      ["Vervoer en activiteiten", "Transport and activities"],
    ],
  },
  {
    icon: WalletCards,
    title: ["Houd iedere valuta en rekening bij", "Track every currency and expense"],
    copy: [
      "Zie budget tegenover werkelijkheid en reken groepskosten eerlijk af met zo min mogelijk overboekingen.",
      "Compare budget with actual spend and settle group expenses fairly with fewer transfers.",
    ],
    points: [
      ["Meerdere valuta", "Multiple currencies"],
      ["Verdeling per persoon", "Split per person"],
      ["Slimme verrekening", "Smart settlement"],
    ],
  },
  {
    icon: Users,
    title: ["Werk samen zonder de controle kwijt te raken", "Collaborate without losing control"],
    copy: [
      "Kies per reis wie mag plannen, financiën beheren of alleen meekijken.",
      "Choose per trip who can plan, manage finances or only view.",
    ],
    points: [
      ["Zes reisrollen", "Six trip roles"],
      ["Financiële privacy", "Financial privacy"],
      ["Gedeelde reizen in het dashboard", "Shared trips in the dashboard"],
    ],
  },
  {
    icon: Share2,
    title: ["Maak van je route een reisverhaal", "Turn your route into a travel story"],
    copy: [
      "Publiceer een verzorgde pagina met intro, kaart, planning en alleen de dagboekherinneringen die je bewust openbaar maakt. Bezoekers zonder account kunnen volgen, liken en begrensd reageren.",
      "Publish a polished page with an introduction, map, itinerary and only the journal memories you intentionally make public. Visitors without an account can follow, like and leave bounded comments.",
    ],
    points: [
      ["Foto's en maximaal twee video's per herinnering", "Photos and up to two videos per memory"],
      ["PIN en bevestigde volgers", "PIN and confirmed followers"],
      [
        "Reacties beheren en privégegevens afschermen",
        "Manage comments and protect private details",
      ],
    ],
  },
] as const;

const CAPABILITIES = [
  {
    icon: UserRound,
    title: ["Deel vanuit je eigen reizigersprofiel", "Share from your own traveller profile"],
    copy: [
      "Kies zelf een unieke profielnaam, biografie en bezochte landen. Toon alleen reizen die je bewust openbaar en zonder PIN deelt en beheer vriendschappen. Een openbaar reizigersprofiel is beschikbaar voor Free en Pro; Agency-accounts delen via hun zakelijke reislinks.",
      "Choose your own unique username, biography and visited countries. Show only trips you deliberately share publicly without a PIN and manage friendships. Public traveller profiles are available for Free and Pro; Agency accounts share through their business trip links.",
    ],
    badge: ["Vrijwillig en standaard privé", "Optional and private by default"],
  },
  {
    icon: GitCompareArrows,
    title: [
      "Zoek verblijf en huurauto met de juiste gegevens",
      "Search stays and rental cars with the right details",
    ],
    copy: [
      "Booking.com-zoekvensters vragen bewust om nachten, gasten, kamers of personen, bagage, tijden en bestuurdersleeftijd. Filter resultaten en bewaar interessante keuzes eerst in de Vergelijker.",
      "Booking.com search dialogs deliberately request nights, guests, rooms or passengers, luggage, times and driver age. Filter results and save interesting choices to Trip Comparison first.",
    ],
    badge: ["Begeleid zoeken", "Guided search"],
  },
  {
    icon: GitCompareArrows,
    title: ["Vergelijk en beslis samen", "Compare and decide together"],
    copy: [
      "Zet verblijven, vervoer en activiteiten naast elkaar, bespreek kandidaten en laat reisleden stemmen voordat je precies één keuze als boeking vastlegt.",
      "Compare stays, transport and activities, discuss candidates and let trip members vote before turning exactly one choice into a booking.",
    ],
    badge: ["Reisvergelijker", "Trip comparison"],
  },
  {
    icon: WifiOff,
    title: ["Voorbereid zonder internet", "Prepared without internet"],
    copy: [
      "Bewaar bewust een reisoverzicht, volledige dagboekherinneringen en zelf gekozen foto's op je apparaat. Nieuwe uitgaven en dagboekwijzigingen blijven in een zichtbare wachtrij totdat jij ze synchroniseert.",
      "Explicitly save a trip overview, complete journal memories and selected photos on your device. New expenses and journal changes remain in a visible queue until you sync them.",
    ],
    badge: ["Offline overzicht en wachtrij", "Offline view and queue"],
  },
  {
    icon: BookHeart,
    title: ["Herinneringen in een echt reisdagboek", "Memories in a real travel journal"],
    copy: [
      "Open het dagboek als eigen omgeving, schrijf per reisdag en beheer foto's, video's, bijschriften en omslagfoto's. Bekijk tijdlijn, galerij en kaart, maak een gecontroleerde samenvatting en exporteer je terugblik als PDF.",
      "Open the journal as its own workspace, write for each travel day and manage photos, videos, captions and cover photos. Browse the timeline, gallery and map, create a reviewed summary and export your story as a PDF.",
    ],
    badge: ["Dagboek en publieke terugblik", "Journal and public story"],
  },
  {
    icon: LocateFixed,
    title: ["Zie wat onderweg nog ontbreekt", "See what is still missing"],
    copy: [
      "De reisstart toont nachten waarvoor nog geen verblijf is vastgelegd. In Ontdekken zoek je restaurants, activiteiten, bezienswaardigheden en praktische plekken rond je route; je voegt pas iets toe nadat je zelf kiest.",
      "The trip overview shows nights that still lack accommodation. Discover helps find restaurants, activities, sights and practical places along your route; nothing is added until you choose it.",
    ],
    badge: ["Verblijfcontrole en Ontdekken", "Stay check and Discover"],
  },
  {
    icon: Waypoints,
    title: ["Routeplanning over echte wegen", "Routing on real roads"],
    copy: [
      "Bereken maximaal 200 routepunten voor auto, fiets of lopen. Vergelijk echte wegafstand en reistijd, vermijd tolwegen of veerboten en bekijk rustvoorstellen voordat je iets toepast.",
      "Calculate up to 200 route points for driving, cycling or walking. Compare actual road distance and travel time, avoid toll roads or ferries, and review suggested breaks before applying anything.",
    ],
    badge: ["Altijd met voor- en na-preview", "Always with before and after preview"],
  },
  {
    icon: BellRing,
    title: ["Meldingen die jij beheert", "Notifications you control"],
    copy: [
      "Kies e-mail-, portaal- en browsermeldingen. Pro gebruikt vlak voor vertrek AeroDataBox-alerts voor relevante tijd-, gate-, terminal- en statuswijzigingen, met periodieke controle als vangnet en zonder reisdetails in een pushbericht.",
      "Choose email, portal and browser notifications. Close to departure, Pro uses AeroDataBox alerts for relevant time, gate, terminal and status changes, with periodic checks as a fallback and without trip details in a push notification.",
    ],
    badge: ["Webpush en vluchtcontrole", "Web push and flight monitoring"],
  },
  {
    icon: FileInput,
    title: ["Importeer, exporteer en abonneer", "Import, export and subscribe"],
    copy: [
      "Importeer routepunten uit GPX na een preview. Exporteer je reis als JSON, CSV, GPX of ICS en je dagboek als PDF. PDF-declaraties en een persoonlijke live agendalink voor de reiseigenaar zijn beschikbaar met Pro of Agency.",
      "Import route points from GPX after a preview. Export your trip as JSON, CSV, GPX or ICS and your journal as PDF. PDF expense reports and a personal live calendar link for the trip owner are available with Pro or Agency.",
    ],
    badge: ["Open formaten", "Open formats"],
  },
  {
    icon: ShieldCheck,
    title: ["Controle over toegang en privacy", "Control over access and privacy"],
    copy: [
      "Gebruik Google of Discord, passkeys en TOTP. Beheer sessies, communicatievoorkeuren en privacyverzoeken terwijl reisrollen gevoelige financiële informatie begrenzen.",
      "Use Google or Discord, passkeys and TOTP. Manage sessions, communication preferences and privacy requests while trip roles restrict sensitive financial information.",
    ],
    badge: ["Accountbeveiliging", "Account security"],
  },
] as const;

const PHASE_LABELS = [
  ["Route", "Route"],
  ["Dagplanning", "Itinerary"],
  ["Boekingen", "Bookings"],
  ["Uitgaven", "Expenses"],
  ["Samenwerken", "Together"],
  ["Dagboek", "Journal"],
] as const;

export function FeaturesPage() {
  const { user } = useAuth();
  const { text } = useLocale();
  return (
    <MarketingMotion className="marketing-page features-page space-y-12 pb-8 sm:space-y-16">
      <section className="marketing-hero features-hero grid items-center gap-8 rounded-3xl p-5 sm:p-9 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:p-12">
        <div>
          <Badge variant="secondary" className="gap-1.5">
            <Globe2 className="size-3.5" />
            {text("Van plannen tot thuiskomen", "From planning to coming home")}
          </Badge>
          <h1 className="mt-5 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-5xl">
            {text(
              "Alles wat je reis nodig heeft. Eindelijk bij elkaar.",
              "Everything your trip needs. Finally together.",
            )}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            {text(
              "Van je eerste bestemming tot de laatste gedeelde rekening. Ontdek wat je kunt regelen, op jouw manier.",
              "From your first destination to the final shared expense. Explore what you can organise, your way.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={portalUrl(user ? "/dashboard" : "/register")}>
                {user
                  ? text("Open mijn reizen", "Open my trips")
                  : text("Start gratis", "Start for free")}
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/demo">{text("Probeer de demo", "Try the demo")}</Link>
            </Button>
          </div>
        </div>
        <div className="hidden lg:block">
          <FeatureIllustration phase={5} />
        </div>
      </section>

      <section id="ontdek" className="space-y-6 scroll-mt-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {text("Kies wat je wilt ontdekken", "Choose what to explore")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {text("Een plek voor ieder deel van je reis", "A place for every part of your trip")}
          </h2>
        </div>
        <Tabs defaultValue="0" className="feature-explorer">
          <TabsList
            aria-label={text("Onderdelen van de reisplanner", "Trip planner features")}
            className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-3 lg:grid-cols-6"
          >
            {PHASES.map(({ icon: Icon }, index) => (
              <TabsTrigger
                key={index}
                value={String(index)}
                className="feature-tab min-h-14 gap-2 whitespace-normal border bg-card px-3 py-3 text-center data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Icon className="size-4 shrink-0" />
                {text(PHASE_LABELS[index]![0], PHASE_LABELS[index]![1])}
              </TabsTrigger>
            ))}
          </TabsList>
          {PHASES.map(({ icon: Icon, title, copy, points }, index) => (
            <TabsContent
              key={index}
              value={String(index)}
              forceMount
              className="mt-5 data-[state=inactive]:hidden"
            >
              <div className="grid items-center gap-6 rounded-3xl border bg-card p-5 sm:p-8 lg:grid-cols-2 lg:gap-10">
                <div>
                  <span className={`feature-icon feature-tone-${index % 3}`}>
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 max-w-lg font-display text-2xl font-semibold sm:text-3xl">
                    {text(title[0], title[1])}
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                    {text(copy[0], copy[1])}
                  </p>
                  <ul className="mt-5 space-y-3 text-sm">
                    {points.map((point) => (
                      <li key={point[0]} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {text(point[0], point[1])}
                      </li>
                    ))}
                  </ul>
                </div>
                <FeatureIllustration phase={index} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {text("Ook aan gedacht", "The details, covered")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            {text(
              "Meer mogelijkheden, als jij ze nodig hebt",
              "More possibilities, when you need them",
            )}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text(
              "Open een onderwerp voor de details. Van offline gebruik tot vluchtupdates en je eigen reisprofiel.",
              "Open a topic for the details. From offline use to flight updates and your own travel profile.",
            )}
          </p>
        </div>
        <Accordion type="multiple" className="grid items-start gap-3 md:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, copy, badge }, index) => (
            <AccordionItem
              key={title[0]}
              value={String(index)}
              className="rounded-2xl border bg-card px-4 sm:px-5"
            >
              <AccordionTrigger className="min-h-24 gap-3 py-4 text-left hover:no-underline">
                <span className={`feature-icon shrink-0 feature-tone-${index % 3}`}>
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 text-sm font-semibold leading-relaxed">
                  {text(title[0], title[1])}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <p className="text-sm leading-7 text-muted-foreground">{text(copy[0], copy[1])}</p>
                <p className="mt-4 text-xs font-medium text-primary">{text(badge[0], badge[1])}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="feature-plan-note flex flex-col gap-5 rounded-3xl border p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold">
            {text(
              "Begin met Free. Groei als je meer nodig hebt.",
              "Start with Free. Grow when you need more.",
            )}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text(
              "Twee actieve reizen en samen plannen zijn inbegrepen. Pro voegt onder meer onbeperkt reizen en live weer toe. Agency is voor professioneel klantbeheer.",
              "Two active trips and planning together are included. Pro adds unlimited trips and live weather, among other extras. Agency is for professional client management.",
            )}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 self-start lg:self-auto">
          <Link to="/pricing">
            {text("Vergelijk de abonnementen", "Compare plans")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
      <MarketingClosing
        title={["Wat wordt jouw volgende bestemming?", "Where will you go next?"]}
        description={[
          "Maak je eerste reis en nodig je reisgenoten uit. Je kunt gratis beginnen.",
          "Create your first trip and invite your fellow travellers. You can start for free.",
        ]}
      />
    </MarketingMotion>
  );
}
