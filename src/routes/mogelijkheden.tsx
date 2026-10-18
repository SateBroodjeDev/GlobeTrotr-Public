import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  BookHeart,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarRange,
  Check,
  FileDown,
  FileInput,
  GitCompareArrows,
  Globe2,
  ListChecks,
  LocateFixed,
  MapPinned,
  Plane,
  ReceiptText,
  Share2,
  ShieldCheck,
  Users,
  UserRound,
  WalletCards,
  Waypoints,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { portalUrl } from "@/lib/site-routing";

export const Route = createFileRoute("/mogelijkheden")({
  head: () => ({
    meta: [
      { title: "Mogelijkheden — GlobeTrotr" },
      {
        name: "description",
        content:
          "Ontdek routes, planning, boekingen, uitgaven, samenwerking en openbare reisverhalen in GlobeTrotr.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/features" }],
  }),
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

const FREE_FEATURES = [
  ["Twee actieve reizen", "Two active trips"],
  ["Route, dagplanning, boekingen en uitgaven", "Route, itinerary, bookings and expenses"],
  [
    "Samenwerken, verrekenen, vergelijken en stemmen",
    "Collaboration, settlement, comparison and voting",
  ],
  ["Persoonlijke en gezamenlijke paklijsten", "Personal and shared packing lists"],
  [
    "Openbaar profiel, bezochte landen en vrienden",
    "Public profile, visited countries and friends",
  ],
  ["Reisdagboek met foto's, samenvatting en PDF", "Travel journal with photos, summary and PDF"],
  [
    "Openbare live terugblik met bevestigde e-mailvolgers",
    "Public live story with confirmed email followers",
  ],
  [
    "Offline overzicht en gecontroleerde synchronisatie",
    "Offline overview and controlled synchronisation",
  ],
  ["CSV-, JSON-, GPX- en ICS-export", "CSV, JSON, GPX and ICS export"],
] as const;

const PRO_FEATURES = [
  ["Onbeperkt actieve reizen", "Unlimited active trips"],
  ["Alles uit Free", "Everything in Free"],
  ["Live weer per bestemming", "Live weather for each destination"],
  ["Dertig vluchtcontroles per gebruiker per dag", "Thirty flight checks per user per day"],
  [
    "Tweehonderdvijftig routeaanvragen per gebruiker per dag",
    "Two hundred and fifty routing requests per user per day",
  ],
  ["PDF-declaratie van uitgaven", "PDF expense report"],
  [
    "Persoonlijke live agendalink voor de reiseigenaar",
    "Personal live calendar link for the trip owner",
  ],
] as const;

const AGENCY_FEATURES = [
  [
    "Alle Pro-reisfuncties; geen openbaar reizigersprofiel",
    "All Pro trip features; no public traveller profile",
  ],
  ["Klanten, offertes, taken en leveranciers", "Clients, quotes, tasks and suppliers"],
  ["Teamrollen en zakelijke rechten", "Team roles and business permissions"],
  [
    "Eigen branding, Agency-subdomein en geverifieerd domein",
    "Custom branding, Agency subdomain and verified domain",
  ],
  ["Eigen SMTP en merkgebonden klantcommunicatie", "Custom SMTP and branded client communication"],
] as const;

export function FeaturesPage() {
  const { user } = useAuth();
  const { text } = useLocale();
  return (
    <div className="marketing-page features-page space-y-10 pb-8 sm:space-y-16">
      <header className="marketing-hero border-b py-8 sm:py-12 lg:py-16">
        <div className="max-w-4xl">
          <div>
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <Globe2 className="size-3.5" />{" "}
              {text("Van plannen tot thuiskomen", "From planning to coming home")}
            </Badge>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
              {text(
                "Alles wat je reis nodig heeft. Eindelijk bij elkaar.",
                "Everything your trip needs. Finally together.",
              )}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed opacity-90">
              {text(
                "GlobeTrotr vervangt de losse spreadsheet, chatberichten en screenshots door één levend reisoverzicht voor de hele groep.",
                "GlobeTrotr replaces scattered spreadsheets, chat messages and screenshots with one living trip overview for the whole group.",
              )}
            </p>
            <Button asChild size="lg" className="mt-7 w-full sm:w-auto">
              <a href={portalUrl(user ? "/dashboard" : "/register")}>
                {user
                  ? text("Open mijn reizen", "Open my trips")
                  : text("Probeer GlobeTrotr gratis", "Try GlobeTrotr free")}
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
            {text("De hele reiscyclus", "The complete trip lifecycle")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {text(
              "Van eerste prik op de kaart tot de laatste terugbetaling",
              "From the first map pin to the final repayment",
            )}
          </h2>
        </div>
        <div className="marketing-phases mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {PHASES.map(({ icon: Icon, title, copy, points }, index) => (
            <Card key={title[0]} className="marketing-editorial-card overflow-hidden">
              <CardContent className="grid gap-5 p-6 sm:grid-cols-[auto_1fr]">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-primary">0{index + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold">
                    {text(title[0], title[1])}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text(copy[0], copy[1])}
                  </p>
                  <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {points.map((point) => (
                      <li key={point[0]} className="flex gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {text(point[0], point[1])}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-muted/20 p-6 sm:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
            {text("Free, Pro of Agency", "Free, Pro or Agency")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            {text(
              "Van eigen reis tot professioneel klantportaal",
              "From personal trip to professional client portal",
            )}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {text(
              "Free bevat de complete planner, Pro haalt de reislimiet weg en Agency voegt het zakelijke klantportaal met eigen merk, domein en communicatie toe.",
              "Free contains the complete planner, Pro removes the trip limit and Agency adds the professional client portal with custom branding, domains and communication.",
            )}
          </p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <PlanFeatures icon={Plane} name="Free" price="€0" items={FREE_FEATURES} text={text} />
          <PlanFeatures
            icon={Users}
            name="Pro"
            price="€9 / maand"
            priceEn="€9 / month"
            items={PRO_FEATURES}
            text={text}
            featured
          />
          <PlanFeatures
            icon={BriefcaseBusiness}
            name="Agency"
            price="€29 / maand"
            priceEn="€29 / month"
            items={AGENCY_FEATURES}
            text={text}
          />
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link to="/pricing">
              {text("Bekijk de volledige vergelijking", "View the full comparison")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
            {text("Meer dan de basis", "Beyond the basics")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {text(
              "Ook de lastige stukken van een reis geregeld",
              "The complicated parts of a trip, handled too",
            )}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text(
              "Kies de onderdelen die bij jouw reis passen: plannen, samenwerken, onderweg overzicht houden en herinneringen bewaren.",
              "Choose the parts that suit your trip: planning, collaborating, staying organised on the road and keeping memories.",
            )}
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, copy, badge }) => (
            <Card key={title[0]} className="marketing-editorial-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="outline">{text(badge[0], badge[1])}</Badge>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">
                  {text(title[0], title[1])}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {text(copy[0], copy[1])}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-muted/20 p-6 sm:p-10">
        <div className="grid gap-9 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <Badge variant="outline">{text("Voor onderweg", "For the road")}</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold">
              {text(
                "Je belangrijkste informatie ook op je telefoon",
                "Your essential information on your phone",
              )}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {text(
                "Open je dagplanning, controleer een boeking, vink je paklijst af, voeg een uitgave toe of leg meteen een herinnering vast.",
                "Open today's itinerary, check a booking, tick your packing list, add an expense or capture a memory immediately.",
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                ListChecks,
                text("Paklijst per persoon en samen", "Personal and shared packing lists"),
              ],
              [
                ReceiptText,
                text("Uitgaven en verdeling per persoon", "Expenses and split per person"),
              ],
              [BookOpenCheck, text("Printbare reisgids", "Printable trip guide")],
              [
                FileDown,
                text("CSV-, dagboek-PDF- en JSON-export", "CSV, journal PDF and JSON export"),
              ],
            ].map(([Icon, label]) => (
              <div
                key={String(label)}
                className="flex items-center gap-3 rounded-2xl border bg-background p-4"
              >
                <Icon className="size-5 text-primary" />
                <span className="text-sm font-medium">{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold">
            {text("Gemaakt voor jullie manier van reizen", "Made for the way you travel")}
          </h2>
        </div>
        <div className="mx-auto mt-7 grid max-w-6xl gap-4 md:grid-cols-3">
          <Audience
            icon={Users}
            title={text("Vrienden, koppels en families", "Friends, couples and families")}
            body={text(
              "Plan samen, voorkom betaalverzoeken-chaos en geef iedereen hetzelfde actuele overzicht.",
              "Plan together, avoid payment-request chaos and give everyone the same current overview.",
            )}
          />
          <Audience
            icon={Globe2}
            title={text("Solo en meerdere reizen", "Solo and multiple trips")}
            body={text(
              "Bewaar komende, huidige en gearchiveerde reizen naast elkaar in één persoonlijk dashboard.",
              "Keep upcoming, current and archived trips together in one personal dashboard.",
            )}
          />
          <Audience
            icon={BriefcaseBusiness}
            title={text("Reisadviseurs en organisaties", "Travel advisers and organisations")}
            body={text(
              "Werk met klanten, teamrechten, eigen branding, domeinen, formulieren en zakelijke e-mail vanuit één Agency-omgeving.",
              "Work with clients, team permissions, custom branding, domains, forms and business email from one Agency workspace.",
            )}
          />
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/for-agencies" className="text-primary underline">
            {text("Bekijk alle Agency-mogelijkheden.", "View all Agency capabilities.")}
          </Link>
        </p>
      </section>

      <section className="marketing-invitation px-6 py-11 text-center sm:p-14">
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-semibold">
          {text("Begin met een echte reis", "Start with a real trip")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm opacity-85">
          {text(
            "Je kunt gratis starten. Reizen blijven privé totdat jij bewust delen inschakelt.",
            "You can start for free. Trips remain private until you intentionally enable sharing.",
          )}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={portalUrl(user ? "/dashboard" : "/register")}>
              {user
                ? text("Naar mijn dashboard", "Go to my dashboard")
                : text("Account maken", "Create account")}
              <ArrowRight className="size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/demo">{text("Probeer het zelf", "Try it yourself")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Audience({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Users;
  title: string;
  body: string;
}) {
  return (
    <Card className="marketing-editorial-card">
      <CardContent className="p-6">
        <Icon className="size-6 text-primary" />
        <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function PlanFeatures({
  icon: Icon,
  name,
  price,
  priceEn,
  items,
  text,
  featured = false,
}: {
  icon: typeof Users;
  name: string;
  price: string;
  priceEn?: string;
  items: ReadonlyArray<readonly [string, string]>;
  text: (nl: string, en: string) => string;
  featured?: boolean;
}) {
  return (
    <Card className={featured ? "border-primary ring-1 ring-primary/20" : "surface"}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Icon className="size-6 text-primary" />
            {name}
          </span>
          <Badge variant={featured ? "default" : "secondary"}>
            {text(price, priceEn ?? price)}
          </Badge>
        </div>
        <ul className="mt-5 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item[0]} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {text(item[0], item[1])}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
