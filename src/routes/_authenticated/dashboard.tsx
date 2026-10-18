import { trackAnalyticsAction } from "@/lib/analytics";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, MapPin, Wallet, Download, ArrowRight, Share2, X, Loader2, Compass, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { uid, useWorkspace } from "@/lib/workspace";
import { canEdit, countsTowardsTripLimit, ownsTrip, planOf } from "@/lib/plans";
import {
  TEMPLATES,
  STATUS_LABEL,
  tripStatus,
  type TripStatus,
  type TripTemplate,
  type Trip,
  type Stop,
} from "@/lib/types";
import { convert, formatMoney } from "@/lib/services";
import { downloadJson } from "@/lib/exporters";
import { DeleteTripButton } from "@/components/DeleteTripButton";
import { Countdown } from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/lib/locale";
import { localizeTagline } from "@/lib/localized-values";
import { TRIP_NAME_MAX_LENGTH } from "@/lib/trip-limits";
import { TripComparison } from "@/components/TripComparison";
import { TripCover } from "@/components/TripCover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const { state, addTrip, saveTripNow, removeTrip, rates } = useWorkspace();
  const { locale, text } = useLocale();
  const navigate = useNavigate();
  const plan = planOf(state.plan);
  const editable = canEdit(state.role);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<TripTemplate>("citytrip");
  const [filter, setFilter] = useState<TripStatus | "all">("all");
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
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
    <div className="space-y-5 sm:space-y-6">
      <section className="aurora relative overflow-hidden rounded-2xl border border-border/60">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-5 sm:px-6">
            <p className="col-span-2 mb-1 text-xs text-muted-foreground">{localizeTagline(state.branding.tagline, locale)}</p>
            <h1 className="min-w-0 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{text("Jouw reizen", "Your trips")}</h1>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0" disabled={!editable || atLimit}>
              <Plus className="size-4" />{text("Nieuwe reis", "New trip")}
            </Button>
          </DialogTrigger>
            <p className="col-span-2 mt-1 text-xs text-muted-foreground sm:text-sm">
              {text(`${activeTripCount} actieve reizen`, `${activeTripCount} active trips`)}
              <span className="mx-2 opacity-50" aria-hidden="true">·</span>
              {formatMoney(grand, base)} {text("geboekte uitgaven", "recorded expenses")}
            </p>
        </div>
        {focusTrip && <div className="flex flex-wrap items-center gap-3 border-t border-border/50 bg-background/20 px-5 py-4 sm:gap-4 sm:px-6">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex" aria-hidden="true"><Compass className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-primary">{currentTrip ? text("Nu onderweg", "Travelling now") : text("Eerstvolgende reis", "Next trip")}</p>
            <h2 className="break-anywhere font-display text-lg font-semibold leading-snug">{focusTrip.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{shortDate(focusTrip.start)} – {shortDate(focusTrip.end)}</span>
              <span>{focusTrip.stops.length} {text("bestemmingen", "destinations")}</span>
              {!currentTrip && <Countdown date={focusTrip.start} compact />}
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-primary/25 bg-background/60 hover:bg-primary/10">
            <Link to="/trips/$tripId" params={{ tripId: focusTrip.id }}>
              {currentTrip ? text("Bekijk vandaag", "View today") : text("Open reis", "Open trip")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>}
        {yearStats.trips > 0 && <details className="group border-t border-border/50">
          <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-xs transition-colors hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">{text(`Reisjaar ${year}`, `Travel year ${year}`)}</span>
            <span className="text-muted-foreground">{yearStats.countries} {text("landen", "countries")} <span className="mx-1 opacity-50" aria-hidden="true">·</span> {yearStats.tripDays} {text("reisdagen", "travel days")}</span>
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-5 sm:px-6">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-border/50 bg-background/30 p-4 sm:grid-cols-5">
              {[[text("Reizen", "Trips"), yearStats.trips], [text("Landen", "Countries"), yearStats.countries], [text("Plaatsen", "Places"), yearStats.places], [text("Reisdagen", "Travel days"), yearStats.tripDays], [text("Uitgaven", "Expenses"), formatMoney(yearStats.spent, base)]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</dd></div>)}
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{text("Gebaseerd op je reizen en vastgelegde uitgaven.", "Based on your trips and recorded expenses.")}</p>
              <Button type="button" size="sm" variant="ghost" onClick={shareYear}><Share2 className="size-3.5" />{text("Reisjaar delen", "Share travel year")}</Button>
            </div>
          </div>
        </details>}
      </section>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{text("Nieuwe reis aanmaken", "Create a new trip")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
          <label className="space-y-1.5 text-sm">
            <Label htmlFor="new-trip-name">{text("Reisnaam", "Trip name")}</Label>
            <Input id="new-trip-name" value={name} maxLength={TRIP_NAME_MAX_LENGTH} disabled={!editable || creating} onChange={(e) => setName(e.target.value)} placeholder={text("Bijv. Namibië familie-safari", "For example, Namibia family safari")} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm"><Label htmlFor="new-trip-start">{text("Begindatum", "Start date")}</Label><Input id="new-trip-start" type="date" value={startDate} disabled={creating} onChange={(event) => { const value=event.target.value; setStartDate(value); if(!endDate || endDate<value)setEndDate(value); }} /></label>
            <label className="space-y-1.5 text-sm"><Label htmlFor="new-trip-end">{text("Einddatum", "End date")}</Label><Input id="new-trip-end" type="date" min={startDate || undefined} value={endDate} disabled={creating} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-trip-country">{text("Landen", "Countries")}</Label>
            <div className="flex gap-2">
              <select id="new-trip-country" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={country} disabled={creating || countries.length >= 8} onChange={(event) => setCountry(event.target.value)}>
                <option value="">{text("Kies een land", "Choose a country")}</option>
                {countryOptions(locale).filter((option) => !countries.includes(option.code)).map((option) => <option key={option.code} value={option.code}>{option.label} {option.flag}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={!country || creating} onClick={() => { setCountries((current) => [...current, country]); setCountry(""); }}>{text("Toevoegen", "Add")}</Button>
            </div>
            {countries.length > 0 && <div className="flex flex-wrap gap-2">{countries.map((code) => <span key={code} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-sm"><span aria-hidden>{countryFlag(code)}</span>{countryLabel(code, locale)}<button type="button" disabled={creating} onClick={() => setCountries((current) => current.filter((item) => item !== code))} aria-label={text(`${countryLabel(code, locale)} verwijderen`, `Remove ${countryLabel(code, locale)}`)}><X className="size-3.5" /></button></span>)}</div>}
            <p className="text-xs text-muted-foreground">{text("Maximaal 8 landen. Ze worden als eerste routepunten toegevoegd; steden en tussenstops voeg je daarna op de routekaart toe.", "Up to 8 countries. They are added as the first route points; add cities and intermediate stops later on the route map.")}</p>
          </div>
          <div className="space-y-2"><Label>{text("Soort reis", "Trip type")}</Label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={creating}
                onClick={() => setTemplate(t.id)}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
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
          <Button className="w-full" onClick={() => void create()} disabled={!editable || atLimit || creating}>
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
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", "current", "upcoming", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label={text("Alle reizen als JSON downloaden", "Download all trips as JSON")}
          title={text("Alle reizen als JSON downloaden", "Download all trips as JSON")}
          onClick={() => {
            downloadJson(state, state.branding.brandName);
            toast.success(text("Back-up gedownload", "Backup downloaded"));
          }}
        >
          <Download className="size-4" /><span className="hidden sm:inline">{text("Alle reizen", "All trips")} · JSON</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((trip) => {
          const spent = totals.find((t) => t.id === trip.id)!.spent;
          const pct = trip.budget ? Math.min(100, (spent / trip.budget) * 100) : 0;
          const tpl = TEMPLATES.find((t) => t.id === trip.template);
          return (
            <Card key={trip.id} className="surface flex flex-col">
              <div className="overflow-hidden rounded-t-xl"><TripCover tripId={trip.id} editable={false} text={text} compact/></div>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 break-anywhere text-base">
                    <Link
                      to="/trips/$tripId"
                      params={{ tripId: trip.id }}
                      className="hover:underline"
                    >
                      {tpl?.emoji} {trip.name}
                    </Link>
                  </CardTitle>
                  {ownsTrip(trip.accessRole) && (
                    <DeleteTripButton tripName={trip.name} iconOnly onDelete={() => removeTrip(trip.id)} />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{statusLabel(tripStatus(trip), text)}</Badge>
                  {!ownsTrip(trip.accessRole) && (
                    <Badge variant="outline">{text("Gedeeld", "Shared")}</Badge>
                  )}
                  {trip.start} → {trip.end}
                  {tripStatus(trip) === "upcoming" && <Countdown date={trip.start} compact />}
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> {trip.stops.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="size-4" /> {trip.expenses.length}
                  </span>
                </div>
                <Progress value={pct} />
                <p className="text-sm">
                  <span className="font-semibold">{formatMoney(spent, base)}</span>{" "}
                  <span className="text-muted-foreground">
                    {text("van", "of")} {formatMoney(trip.budget, base)}
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {state.trips.length >= 2 && <Card className="surface"><CardHeader className="pb-3"><CardTitle className="text-base">{text("Vergelijk twee reisvarianten", "Compare two trip variants")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span className="text-muted-foreground">{text("Eerste reis", "First trip")}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)}><option value="">{text("Kies een reis", "Choose a trip")}</option>{state.trips.filter((trip) => trip.id !== compareRight).map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">{text("Tweede reis", "Second trip")}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={compareRight} onChange={(event) => setCompareRight(event.target.value)}><option value="">{text("Kies een reis", "Choose a trip")}</option>{state.trips.filter((trip) => trip.id !== compareLeft).map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label></CardContent></Card>}

      {compareLeft && compareRight && (
        <TripComparison
          left={state.trips.find((trip) => trip.id === compareLeft)!}
          right={state.trips.find((trip) => trip.id === compareRight)!}
          base={base}
          rates={rates}
          text={text}
        />
      )}

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
