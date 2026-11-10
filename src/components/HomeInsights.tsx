import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Compass,
  MapPin,
  Plane,
  Route,
  Utensils,
  Users,
  Wallet,
} from "lucide-react";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

const SAMPLES = [
  {
    name: ["Weekend weg", "Weekend away"],
    days: 3,
    stops: 2,
    budget: 600,
    values: [240, 90, 180, 90],
  },
  {
    name: ["Een week Portugal", "A week in Portugal"],
    days: 8,
    stops: 3,
    budget: 1600,
    values: [640, 320, 400, 240],
  },
  {
    name: ["Lange rondreis", "A longer road trip"],
    days: 15,
    stops: 6,
    budget: 3200,
    values: [1120, 960, 640, 480],
  },
] as const;
const CATEGORIES = [
  { icon: BedDouble, label: ["Verblijf", "Stays"], color: "home-chart-mint" },
  { icon: Plane, label: ["Vervoer", "Transport"], color: "home-chart-blue" },
  { icon: Utensils, label: ["Eten & drinken", "Food & drink"], color: "home-chart-peach" },
  { icon: Compass, label: ["Belevenissen", "Experiences"], color: "home-chart-lilac" },
] as const;

type Totals = { trips: number; travelers: number; activities: number };
async function loadTotals(): Promise<Totals | null> {
  const response = await fetch("/api/public/stats", { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("statistics" in body)) return null;
  const stats = body.statistics;
  if (!stats || typeof stats !== "object") return null;
  const values = stats as Record<string, unknown>;
  if (
    !["trips", "travelers", "activities"].every(
      (key) => Number.isSafeInteger(values[key]) && Number(values[key]) >= 0,
    )
  )
    return null;
  return {
    trips: Number(values.trips),
    travelers: Number(values.travelers),
    activities: Number(values.activities),
  };
}

export function HomeInsights() {
  const { text, locale } = useLocale();
  const [selected, setSelected] = useState(1);
  const sample = SAMPLES[selected]!;
  const totals = useQuery({
    queryKey: ["public-home-statistics"],
    queryFn: loadTotals,
    retry: false,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const facts = totals.data
    ? [
        {
          icon: Route,
          value: number(totals.data.trips),
          label: text("Reizen vastgelegd", "Trips recorded"),
        },
        {
          icon: Users,
          value: number(totals.data.travelers),
          label: text("Reizigersprofielen", "Traveller profiles"),
        },
        {
          icon: Compass,
          value: number(totals.data.activities),
          label: text("Activiteiten gepland", "Activities planned"),
        },
      ]
    : [
        {
          icon: Route,
          value: "2",
          label: text("Actieve reizen met Free", "Active trips with Free"),
        },
        {
          icon: Users,
          value: text("Samen", "Together"),
          label: text("Plannen kan al gratis", "Plan together for free"),
        },
        {
          icon: Wallet,
          value: text("Jouw keuze", "Your choice"),
          label: text("Free, Pro of Agency", "Free, Pro or Agency"),
        },
      ];

  return (
    <section
      className="home-insights grid items-center gap-8 rounded-3xl p-5 sm:p-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-12 lg:p-10"
      aria-labelledby="home-insights-title"
    >
      <div className="min-w-0">
        <span className="home-insights-icon">
          <Wallet className="size-6" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">
          {text("Van losse plannen naar overzicht", "From scattered plans to a clear picture")}
        </p>
        <h2
          id="home-insights-title"
          className="mt-3 max-w-lg font-display text-3xl font-semibold leading-tight sm:text-4xl"
        >
          {text(
            "Meer voorpret. Minder uitzoekwerk.",
            "More anticipation. Less figuring things out.",
          )}
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
          {text(
            "Waar ga je heen, wat is geregeld en wat geven jullie uit? Geef route, boekingen en kosten een vaste plek. Zo blijft er ruimte voor de reis zelf.",
            "Where are you going, what is arranged and what are you spending? Give routes, bookings and expenses a home. Leave more room for the trip itself.",
          )}
        </p>
        <div className="mt-6" aria-live="polite">
          <p className="min-h-6 text-xs font-medium text-muted-foreground">
            {totals.data
              ? text(
                  "Over heel GlobeTrotr · platformtotalen",
                  "Across GlobeTrotr · platform totals",
                )
              : text("Zo begin je met GlobeTrotr", "Getting started with GlobeTrotr")}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {facts.map(({ icon: Icon, value, label }, index) => (
              <div key={index} className={`home-fact home-fact-${index}`}>
                <Icon className="size-4" aria-hidden="true" />
                <dd className="mt-3 break-words font-display text-lg font-semibold sm:text-xl">
                  {value}
                </dd>
                <dt className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <Button asChild variant="link" className="mt-4 px-0">
          <Link to="/features">
            {text("Ontdek wat er allemaal kan", "Explore what you can do")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="home-budget min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {text("Je reis in cijfers", "Your trip in numbers")}
          </p>
          <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
            {text("Voorbeeldcijfers", "Illustrative figures")}
          </span>
        </div>
        <div
          role="group"
          aria-label={text("Kies een voorbeeldreis", "Choose a trip illustration")}
          className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1"
        >
          {SAMPLES.map(({ name }, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelected(index)}
              aria-pressed={selected === index}
              className={`min-h-12 rounded-lg px-2 py-2 text-xs font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
            >
              {text(name[0], name[1])}
            </button>
          ))}
        </div>
        <div className="mt-6" role="status" aria-live="polite" aria-atomic="true">
          <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {sample.days} {text("dagen", "days")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {sample.stops} {text("stops", "stops")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />2 {text("reizigers", "travellers")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {text("Voorbeeldbudget voor twee", "Illustrative budget for two")}
          </p>
          <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
            {money(sample.budget)}
          </p>
          <dl className="mt-6 space-y-4">
            {CATEGORIES.map(({ icon: Icon, label, color }, index) => (
              <div key={index}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <dt className="inline-flex items-center gap-2">
                    <span className={`home-category-icon ${color}`}>
                      <Icon className="size-3.5" />
                    </span>
                    {text(label[0], label[1])}
                  </dt>
                  <dd className="font-medium tabular-nums">{money(sample.values[index]!)}</dd>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={`home-budget-bar h-full rounded-full ${color}`}
                    style={{ width: `${(sample.values[index]! / sample.budget) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
          {text(
            "Kies een reistype om de verdeling te bekijken. Fictieve bedragen, geen prijsopgave.",
            "Choose a trip type to explore the breakdown. Fictional amounts, not a quote.",
          )}
        </p>
      </div>
    </section>
  );
}
