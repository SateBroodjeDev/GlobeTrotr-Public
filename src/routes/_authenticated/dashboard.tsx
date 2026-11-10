import { trackAnalyticsAction } from "@/lib/analytics";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Download, Share2, X, Loader2, Compass, CalendarRange, GitCompareArrows, FileJson } from "lucide-react";
import { toast } from "sonner";
import { uid, useWorkspace } from "@/lib/workspace";
import { canEdit, countsTowardsTripLimit, ownsTrip, planOf } from "@/lib/plans";
import {
  TEMPLATES,
  STATUS_LABEL,
  tripStatus,
  type TripStatus,
  type TripTemplate,
  type Stop,
} from "@/lib/types";
import { convert, formatMoney } from "@/lib/services";
import { downloadJson } from "@/lib/exporters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/lib/locale";

import { TRIP_NAME_MAX_LENGTH } from "@/lib/trip-limits";
import { TripComparison } from "@/components/TripComparison";
import { TripOverviewCard } from "@/components/TripOverviewCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { calculateYearStatistics } from "@/lib/trip-statistics";
import { Label } from "@/components/ui/label";
import { countryFlag, countryLabel, countryOptions } from "@/lib/countries";
import { searchPlacesServer } from "@/lib/place.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Reizen — GlobeTrotr Multi-Trip Planner" },
      {
        name: "description",
        content:
          "Overzicht van al je reizen: budget, uitgaven in elke valuta en bestemmingen wereldwijd.",
      },
      { property: "og:title", content: "Reizen — GlobeTrotr Multi-Trip Planner" },
      {
        property: "og:description",
        content: "Beheer al je reizen, budgetten en declaraties op één plek.",
      },
    ],
  }),
  component: TripsOverview,
});

function TripsOverview() {
  const { state, addTrip, saveTripNow, removeTrip, rates, cloud } = useWorkspace();
  const { locale, text } = useLocale();
  const navigate = useNavigate();
  const plan = planOf(state.plan);
  const editable = canEdit(state.role);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<TripTemplate>("citytrip");
  const [filter, setFilter] = useState<TripStatus | "all">("all");
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const comparisonLeft = state.trips.find((trip) => trip.id === compareLeft);
  const comparisonRight = state.trips.find((trip) => trip.id === compareRight);
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const activeOwnedTripCount = state.trips.filter((trip) => countsTowardsTripLimit(trip)).length;
  const activeTripCount = state.trips.filter((trip) => tripStatus(trip) !== "archived").length;
  const atLimit = activeOwnedTripCount >= plan.tripLimit;
  const base = state.baseCurrency;
  const year = new Date().getFullYear();
  const yearStats = calculateYearStatistics(state.trips, year, (amount, currency) => convert(amount, currency, base, rates));

  const totals = state.trips.map((t) => ({
    id: t.id,
    spent: t.expenses.reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0),
  }));
  const grand = totals.reduce((s, t) => s + t.spent, 0);

  const counts: Record<TripStatus, number> = { current: 0, upcoming: 0, archived: 0 };
  for (const t of state.trips) counts[tripStatus(t)] += 1;
  const visible = state.trips
    .filter((trip) => filter === "all" || tripStatus(trip) === filter)
    .sort((left, right) => {
      const rank = { current: 0, upcoming: 1, archived: 2 };
      const byStatus = rank[tripStatus(left)] - rank[tripStatus(right)];
      return byStatus || (tripStatus(left) === "archived"
        ? right.end.localeCompare(left.end)
        : left.start.localeCompare(right.start));
    });
  const nextTrip = state.trips
    .filter((t) => tripStatus(t) === "upcoming")
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const currentTrip = state.trips
    .filter((trip) => tripStatus(trip) === "current")
    .sort((a, b) => (a.end || "9999-12-31").localeCompare(b.end || "9999-12-31"))[0];
  const focusTrip = currentTrip ?? nextTrip;
  const shortDate = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: value.startsWith(String(year)) ? undefined : "numeric" }).format(date)
      : value;
  };

  async function create() {
    if (!name.trim()) {
      toast.error(text("Geef de reis een naam", "Give your trip a name"));
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      toast.error(text("Vul geldige reisdata in; de einddatum moet op of na de startdatum liggen.", "Enter valid travel dates; the end date must be on or after the start date."));
      return;
    }
    if (!countries.length) {
      toast.error(text("Kies minimaal één land.", "Choose at least one country."));
      return;
    }
    if (name.trim().length > TRIP_NAME_MAX_LENGTH) {
      toast.error(
        text(
          `De reisnaam mag maximaal ${TRIP_NAME_MAX_LENGTH} tekens bevatten.`,
          `The trip name can contain up to ${TRIP_NAME_MAX_LENGTH} characters.`,
        ),
      );
      return;
    }
    if (atLimit) {
      toast.error(
        text(
          `Je ${plan.name}-plan staat ${plan.tripLimit} actieve reizen toe. Rond een reis af of upgrade naar Pro.`,
          `Your ${plan.name} plan allows ${plan.tripLimit} active trips. Complete a trip or upgrade to Pro.`,
        ),
      );
      return;
    }
    setCreating(true);
    try {
      const resolvedStops: Stop[] = [];
      for (const code of countries) {
        const label = countryLabel(code, locale);
        const results = await searchPlacesServer({ data: { query: label, language: locale === "en-GB" ? "en" : "nl" } });
        const result = results[0];
        if (!result) throw new Error("COUNTRY_LOCATION_NOT_FOUND");
        resolvedStops.push({ id: uid(), name: label, country: code, lat: result.lat, lon: result.lon, nights: 0 });
      }
      const id = await addTrip(name.trim(), template);
      await saveTripNow(id, (trip) => ({
        ...trip,
        start: startDate,
        end: endDate,
        stops: resolvedStops,
        itinerary: trip.itinerary.map((item) => ({ ...item, day: startDate })),
      }));
      setName("");
      setStartDate("");
      setEndDate("");
      setCountry("");
      setCountries([]);
      setCreateOpen(false);
      trackAnalyticsAction("trip_created");
      toast.success(text("Reis aangemaakt", "Trip created"));
      navigate({ to: "/trips/$tripId", params: { tripId: id } });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes("COUNTRY_LOCATION_NOT_FOUND")
          ? text("Een gekozen land kon niet op de kaart worden gevonden. Probeer het opnieuw.", "A selected country could not be found on the map. Please try again.")
          : text("De reis kon niet worden aangemaakt. Probeer het opnieuw.", "The trip could not be created. Please try again."),
      );
    } finally {
      setCreating(false);
    }
  }

  async function shareYear() {
    const summary = text(
      `${year}: ${yearStats.trips} reizen · ${yearStats.countries} landen · ${yearStats.places} plaatsen · ${yearStats.tripDays} reisdagen · ${formatMoney(yearStats.spent, base)} uitgaven${yearStats.recordedDistanceKm > 0 ? ` · ${Math.round(yearStats.recordedDistanceKm)} km vastgelegd` : ""}`,
      `${year}: ${yearStats.trips} trips · ${yearStats.countries} countries · ${yearStats.places} places · ${yearStats.tripDays} travel days · ${formatMoney(yearStats.spent, base)} expenses${yearStats.recordedDistanceKm > 0 ? ` · ${Math.round(yearStats.recordedDistanceKm)} km recorded` : ""}`,
    );
    try {
      if (navigator.share) await navigator.share({ title: text(`Reisjaar ${year}`, `Travel year ${year}`), text: summary });
      else { await navigator.clipboard.writeText(summary); toast.success(text("Jaarsamenvatting gekopieerd.", "Year summary copied.")); }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(text("Delen is niet gelukt.", "Sharing failed.")); }
  }

  return (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3" data-trips-heading>
        <div className="min-w-0"><h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{text("Jouw reizen", "Your trips")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{text(`${activeTripCount} actieve reizen`, `${activeTripCount} active trips`)} <span className="mx-1.5" aria-hidden="true">·</span> {formatMoney(grand, base)} {text("geboekte uitgaven", "recorded expenses")}</p>
        </div>
        <DialogTrigger asChild><Button className="min-h-11 shrink-0" disabled={!editable || atLimit}><Plus className="size-4"/>{text("Nieuwe reis", "New trip")}</Button></DialogTrigger>
      </header>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{text("Nieuwe reis aanmaken", "Create a new trip")}</DialogTitle>
            <DialogDescription>{text("Geef je reis een naam, kies de datums en voeg minimaal één land toe.", "Name your trip, choose the dates and add at least one country.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <Label htmlFor="new-trip-name">{text("Reisnaam", "Trip name")}</Label>
            <Input id="new-trip-name" aria-required="true" value={name} maxLength={TRIP_NAME_MAX_LENGTH} disabled={!editable || creating} onChange={(e) => setName(e.target.value)} placeholder={text("Bijv. Namibië familie-safari", "For example, Namibia family safari")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm"><Label htmlFor="new-trip-start">{text("Begindatum", "Start date")}</Label><Input id="new-trip-start" aria-required="true" type="date" value={startDate} disabled={creating} onChange={(event) => { const value=event.target.value; setStartDate(value); if(!endDate || endDate<value)setEndDate(value); }} /></div>
            <div className="space-y-2 text-sm"><Label htmlFor="new-trip-end">{text("Einddatum", "End date")}</Label><Input id="new-trip-end" aria-required="true" type="date" min={startDate || undefined} value={endDate} disabled={creating} onChange={(event) => setEndDate(event.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-trip-country">{text("Landen", "Countries")}</Label>
            <div className="flex gap-2">
              <select id="new-trip-country" aria-describedby="new-trip-country-help" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={country} disabled={creating || countries.length >= 8} onChange={(event) => setCountry(event.target.value)}>
                <option value="">{text("Kies een land", "Choose a country")}</option>
                {countryOptions(locale).filter((option) => !countries.includes(option.code)).map((option) => <option key={option.code} value={option.code}>{option.label} {option.flag}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={!country || creating} onClick={() => { setCountries((current) => [...current, country]); setCountry(""); }}>{text("Toevoegen", "Add")}</Button>
            </div>
            {countries.length > 0 && <div className="flex flex-wrap gap-2">{countries.map((code) => <span key={code} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-sm"><span aria-hidden>{countryFlag(code)}</span>{countryLabel(code, locale)}<button type="button" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={creating} onClick={() => setCountries((current) => current.filter((item) => item !== code))} aria-label={text(`${countryLabel(code, locale)} verwijderen`, `Remove ${countryLabel(code, locale)}`)}><X className="size-3.5" /></button></span>)}</div>}
            <p id="new-trip-country-help" className="text-xs leading-relaxed text-muted-foreground">{text("Maximaal 8 landen. Ze worden als eerste routepunten toegevoegd; steden en tussenstops voeg je daarna op de routekaart toe.", "Up to 8 countries. They are added as the first route points; add cities and intermediate stops later on the route map.")}</p>
          </div>
          <div className="space-y-2"><Label>{text("Soort reis", "Trip type")}</Label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={template === t.id}
                disabled={creating}
                onClick={() => setTemplate(t.id)}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  template === t.id
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="mr-1">{t.emoji}</span>
                {templateLabel(t.id, t.label, text)}
              </button>
            ))}
          </div>
          </div>
          <Button className="min-h-11 w-full" aria-busy={creating} onClick={() => void create()} disabled={!editable || atLimit || creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {creating ? text("Reis voorbereiden…", "Preparing trip…") : text("Reis aanmaken", "Create trip")}
          </Button>
          </div>
        </DialogContent>
      {!editable && <p className="text-sm text-muted-foreground">{text("Je huidige rol is alleen-lezen.", "Your current role is read-only.")}</p>}
      {atLimit && <p className="text-sm text-muted-foreground">
        {text(`Limiet van ${plan.tripLimit} actieve reizen bereikt op ${plan.name}.`, `${plan.name} limit of ${plan.tripLimit} active trips reached.`)}{" "}
        <Link to="/billing" className="font-medium text-primary underline">{text("Bekijk abonnementen", "View plans")}</Link>
      </p>}

      <div className="flex items-center gap-3">
        <div role="group" aria-label={text("Reizen filteren", "Filter trips")} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", "current", "upcoming", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === f
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            {f === "all"
              ? `${text("Alles", "All")} (${state.trips.length})`
              : `${statusLabel(f, text)} (${counts[f]})`}
          </button>
        ))}
        </div>
      </div>

      {visible.length === 0 && (
        <Card className="surface">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center sm:py-10">
            {cloud === "loading" ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{text("Reizen laden…", "Loading trips…")}</p>
            ) : (
              <>
                <Compass className="size-7 text-primary" aria-hidden="true" />
                <h2 className="font-display text-lg font-semibold">{state.trips.length === 0 ? text("Je eerste reis begint hier", "Your first trip starts here") : text("Geen reizen in deze selectie", "No trips in this view")}</h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{state.trips.length === 0 ? (editable ? text("Maak een reis aan en breng je route, boekingen en kosten samen.", "Create a trip to bring your route, bookings and expenses together.") : text("Er zijn nog geen reizen beschikbaar voor je account.", "There are no trips available for your account yet.")) : text("Kies een ander filter om je overige reizen te bekijken.", "Choose another filter to see your other trips.")}</p>
                {state.trips.length > 0 ? <Button variant="outline" className="mt-1 min-h-11" onClick={() => setFilter("all")}>{text("Alle reizen bekijken", "View all trips")}</Button> : editable && !atLimit && <Button className="mt-1 min-h-11" onClick={() => setCreateOpen(true)}><Plus className="size-4" />{text("Nieuwe reis", "New trip")}</Button>}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-4 ${visible.length === 1 ? "grid-cols-1" : visible.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`} aria-busy={cloud === "loading"} data-trips-grid>
        {visible.map(trip => <TripOverviewCard key={trip.id} trip={trip} spent={totals.find(item => item.id === trip.id)!.spent}
          base={base} text={text} dateLabel={`${shortDate(trip.start)} – ${shortDate(trip.end)}`}
          wide={visible.length === 1} priority={focusTrip?.id === trip.id ? currentTrip ? text("Nu onderweg", "Travelling now") : text("Eerstvolgende reis", "Next trip") : undefined}
          onDelete={() => removeTrip(trip.id)}/>) }
      </div>

      <div role="group" aria-label={text("Reisoverzichten en export", "Travel summaries and export")}
        className="flex flex-wrap items-center gap-2 pt-1">
        {yearStats.trips > 0 && <Dialog>
          <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 gap-2 bg-transparent px-3 text-xs sm:px-4 sm:text-sm">
            <CalendarRange className="size-4 text-primary" aria-hidden="true"/>{text(`Reisjaar ${year}`, `Travel year ${year}`)}
          </Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>{text(`Jouw reisjaar ${year}`, `Your travel year ${year}`)}</DialogTitle>
              <DialogDescription>{text("Je reizen en vastgelegde uitgaven van dit jaar bij elkaar.", "Your trips and recorded expenses for this year in one place.")}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-5 py-2 sm:grid-cols-3">
              {[[text("Reizen", "Trips"), yearStats.trips], [text("Landen", "Countries"), yearStats.countries], [text("Plaatsen", "Places"), yearStats.places], [text("Reisdagen", "Travel days"), yearStats.tripDays], [text("Uitgaven", "Expenses"), formatMoney(yearStats.spent, base)]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</dd></div>)}
            </dl>
            <div className="flex justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={shareYear}><Share2 className="size-4" aria-hidden="true"/>{text("Reisjaar delen", "Share travel year")}</Button>
            </div>
          </DialogContent>
        </Dialog>}

        {state.trips.length >= 2 && <Dialog>
          <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 gap-2 bg-transparent px-3 text-xs sm:px-4 sm:text-sm"
            aria-label={text("Reizen vergelijken", "Compare trips")} title={text("Reizen vergelijken", "Compare trips")}>
            <GitCompareArrows className="size-4 text-primary" aria-hidden="true"/>{text("Vergelijken", "Compare")}
          </Button></DialogTrigger>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader><DialogTitle>{text("Reisvarianten vergelijken", "Compare trip variants")}</DialogTitle>
              <DialogDescription>{text("Kies twee reizen om routes, boekingen en kosten naast elkaar te bekijken.", "Choose two trips to compare routes, bookings and costs.")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">{text("Eerste reis", "First trip")}</span><select className="h-11 w-full min-w-0 rounded-md border bg-background px-3" value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)}><option value="">{text("Kies een reis", "Choose a trip")}</option>{state.trips.filter((trip) => trip.id !== compareRight).map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">{text("Tweede reis", "Second trip")}</span><select className="h-11 w-full min-w-0 rounded-md border bg-background px-3" value={compareRight} onChange={(event) => setCompareRight(event.target.value)}><option value="">{text("Kies een reis", "Choose a trip")}</option>{state.trips.filter((trip) => trip.id !== compareLeft).map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label>
            </div>
            {comparisonLeft && comparisonRight && <div className="min-w-0"><TripComparison
              left={comparisonLeft}
              right={comparisonRight}
              base={base} rates={rates} text={text}/></div>}
          </DialogContent>
        </Dialog>}

        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 gap-2 bg-transparent px-3 text-xs sm:px-4 sm:text-sm">
            <Download className="size-4 text-primary" aria-hidden="true"/>{text("Exporteren", "Export")}
          </Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{text("Reizen exporteren", "Export trips")}</DialogTitle>
              <DialogDescription>{text("Download je reizen en instellingen als eigen back-up.", "Download your trips and settings as a personal backup.")}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
              <FileJson className="size-6 shrink-0 text-primary" aria-hidden="true"/>
              <div className="min-w-0"><p className="text-sm font-medium">{text("Reizen en instellingen", "Trips and settings")}</p>
                <p className="text-xs text-muted-foreground">{text(`${state.trips.length} ${state.trips.length === 1 ? "reis" : "reizen"} · JSON-bestand`, `${state.trips.length} ${state.trips.length === 1 ? "trip" : "trips"} · JSON file`)}</p></div>
            </div>
            <Button type="button" onClick={() => {
              downloadJson(state, state.branding.brandName);
              toast.success(text("Back-up gedownload", "Backup downloaded"));
              setExportOpen(false);
            }}><Download className="size-4" aria-hidden="true"/>{text("Back-up downloaden", "Download backup")}</Button>
          </DialogContent>
        </Dialog>
      </div>

    </div>
    </Dialog>
  );
}

function statusLabel(status: TripStatus, text: (nl: string, en: string) => string) {
  return text(
    STATUS_LABEL[status],
    { current: "Current", upcoming: "Upcoming", archived: "Archived" }[status],
  );
}

function templateLabel(
  id: TripTemplate,
  fallback: string,
  text: (nl: string, en: string) => string,
) {
  const english: Record<TripTemplate, string> = {
    safari: "Safari",
    cruise: "Cruise",
    citytrip: "City trip",
    roadtrip: "Road trip",
    backpacking: "Backpacking",
    beach: "Beach holiday",
    winter: "Winter trip",
    business: "Business trip",
  };
  return text(fallback, english[id]);
}
