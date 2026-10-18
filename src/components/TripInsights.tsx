import { useState } from "react";
import { BarChart3, CalendarDays, MapPinned, Moon, Route, Share2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CATEGORIES, type Trip } from "@/lib/types";
import { calculateTripStatistics } from "@/lib/trip-statistics";
import { calculateTripRoadRoutes } from "@/lib/road-routing.functions";
import { roadRoutingMessage } from "@/lib/road-routing-messages";
import { mapTripRouteLegs, routePlanFingerprint } from "@/lib/route-map";
import { roadModeForTransport } from "@/lib/road-routing";
import { convert, formatMoney, type Rates } from "@/lib/services";

type Text = (nl: string, en: string) => string;

export function TripInsightsSummary({ trip, base, rates, text, onOpen }: { trip: Trip; base: string; rates: Rates; text: Text; onOpen: () => void }) {
  const stats = calculateTripStatistics(trip, (amount, currency) => convert(amount, currency, base, rates));
  return <section className="rounded-xl border bg-primary/5 p-3" aria-label={text("Je reis in cijfers", "Your trip in numbers")}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <strong className="flex items-center gap-2 text-sm"><BarChart3 className="size-4 text-primary" />{text("Je reis in cijfers", "Your trip in numbers")}</strong>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onOpen}>{text("Alle statistieken", "All insights")}</Button>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="min-w-0"><p className="text-xl font-semibold">{stats.tripDays}</p><p className="text-xs text-muted-foreground">{text("Reisdagen", "Trip days")}</p></div>
      <div className="min-w-0"><p className="text-xl font-semibold">{stats.nights}</p><p className="text-xs text-muted-foreground">{text("Overnachtingen", "Nights")}</p><p className="mt-1 text-xs text-muted-foreground">{text(`${stats.bookedNights} geboekt · ${stats.missingNights} open`, `${stats.bookedNights} booked · ${stats.missingNights} open`)}</p></div>
      <div className="min-w-0"><p className="text-xl font-semibold">{stats.destinations}</p><p className="text-xs text-muted-foreground">{text("Routepunten", "Route stops")}</p><p className="mt-1 text-xs text-muted-foreground">{text(`${stats.countries} landen`, `${stats.countries} countries`)}</p></div>
    </div>
  </section>;
}

export function TripInsights({ trip, base, rates, text }: { trip: Trip; base: string; rates: Rates; text: Text }) {
  const stats = calculateTripStatistics(trip, (amount, currency) => convert(amount, currency, base, rates));
  const [calculatedRoad, setCalculatedRoad] = useState<{ fingerprint: string; distance: number; count: number }>();
  const fingerprint = routePlanFingerprint(trip);
  const routeLegs = mapTripRouteLegs(trip);
  const cachedRoad = routeLegs.flatMap(leg => leg.segment ? [leg.segment] : []);
  const roadResult = calculatedRoad?.fingerprint === fingerprint ? calculatedRoad : cachedRoad.length ? {
    distance: cachedRoad.reduce((sum, segment) => sum + segment.distanceKm, 0), count: cachedRoad.length,
  } : undefined;
  const roadDistance = roadResult?.distance;
  const [calculating, setCalculating] = useState(false);
  const categoryName = (id: string) => {
    const nl = CATEGORIES.find((category) => category.id === id)?.label ?? id;
    const en: Record<string, string> = { transport: "Transport", lodging: "Accommodation", food: "Food and drink", activities: "Activities", shopping: "Shopping", other: "Other" };
    return text(nl, en[id] ?? nl);
  };
  const modeName = (mode: string) => text(({ flight: "Vliegtuig", car: "Auto", motorcycle: "Motor", camper: "Camper", public_transport: "Openbaar vervoer", train: "Trein", bus: "Bus", ferry: "Veerboot", taxi: "Taxi", bicycle: "Fiets", walking: "Lopen", other: "Overig" } as Record<string, string>)[mode] ?? mode, ({ flight: "Flight", car: "Car", motorcycle: "Motorcycle", camper: "Camper", public_transport: "Public transport", train: "Train", bus: "Bus", ferry: "Ferry", taxi: "Taxi", bicycle: "Bicycle", walking: "Walking", other: "Other" } as Record<string, string>)[mode] ?? mode);

  async function calculateDistance() {
    setCalculating(true);
    try {
      const result = await calculateTripRoadRoutes({ data: { tripId: trip.id } });
      setCalculatedRoad({ fingerprint, distance: result.segments.reduce((sum, segment) => sum + segment.distanceKm, 0), count: result.segments.length });
    } catch (error) {
      toast.error(roadRoutingMessage(error, text));
    } finally { setCalculating(false); }
  }

  async function share() {
    const distance = roadDistance ?? (stats.recordedDistanceKm > 0 ? stats.recordedDistanceKm : undefined);
    const summary = [trip.name, `${stats.tripDays} ${text("dagen", "days")}`, `${stats.destinations} ${text("plaatsen", "places")}`, `${stats.countries} ${text("landen", "countries")}`, distance != null ? `${Math.round(distance)} km ${roadDistance != null ? text("over de weg", "by road") : text("vastgelegd", "recorded")}` : undefined, `${text("Uitgaven", "Expenses")}: ${formatMoney(stats.spent, base)}`].filter(Boolean).join(" · ");
    try {
      if (navigator.share) await navigator.share({ title: trip.name, text: summary });
      else { await navigator.clipboard.writeText(summary); toast.success(text("Reissamenvatting gekopieerd.", "Trip summary copied.")); }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; toast.error(text("Delen is niet gelukt.", "Sharing failed.")); }
  }

  return <Card className="surface">
    <CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5"/>{text("Reisstatistieken","Trip insights")}</CardTitle><Button type="button" size="sm" variant="outline" onClick={share}><Share2 className="size-4"/>{text("Delen","Share")}</Button></CardHeader>
    <CardContent className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Insight icon={CalendarDays} label={text("Reisduur","Trip length")} value={text(`${stats.tripDays} dagen`,`${stats.tripDays} days`)}/>
        <Insight icon={MapPinned} label={text("Route","Route")} value={text(`${stats.destinations} plaatsen · ${stats.countries} landen`,`${stats.destinations} places · ${stats.countries} countries`)}/>
        <Insight icon={Moon} label={text("Overnachtingen","Nights")} value={String(stats.nights)} detail={text(`${stats.bookedNights} geboekt · ${stats.missingNights} open`, `${stats.bookedNights} booked · ${stats.missingNights} open`)}/>
        <Insight icon={WalletCards} label={text("Kosten per verstreken dag","Cost per elapsed day")} value={stats.elapsedDays ? formatMoney(stats.dailyAverage,base) : text("Nog niet begonnen","Not started")}/>
        <Insight icon={Route} label={text("Echte wegafstand","Real road distance")} value={roadDistance == null ? "—" : `${roadDistance.toLocaleString()} km`}/>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{text("Wegafstand via echte wegen", "Distance on real roads")}</p><p className="text-xs text-muted-foreground">{text("Alleen ingestelde wegetappes tellen mee. Andere vervoersmiddelen en etappes zonder keuze worden overgeslagen. Berekenen gebruikt routequotum.", "Only configured road stages are included. Other modes and unconfigured stages are skipped. Calculating uses routing quota.")}</p>{roadResult && <p className="mt-1 text-xs text-muted-foreground">{text(`Afstand van ${roadResult.count} berekende wegetappes.`, `Distance for ${roadResult.count} calculated road stages.`)}</p>}</div><Button type="button" variant="outline" disabled={calculating || !routeLegs.some(leg => roadModeForTransport(leg.mode))} onClick={calculateDistance}>{calculating ? text("Berekenen…", "Calculating…") : text("Afstand berekenen", "Calculate distance")}</Button></div>
      {(stats.countryNames.length > 0 || stats.placeNames.length > 0) && <div className="grid gap-3 md:grid-cols-2"><List title={text("Bezochte landen","Visited countries")} values={stats.countryNames}/><List title={text("Bezochte plaatsen","Visited places")} values={stats.placeNames}/></div>}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-medium">{text("Budgettempo","Budget pace")}</p><p className="text-xs text-muted-foreground">{stats.elapsedDays ? text(`${stats.elapsedDays} van ${stats.tripDays} reisdagen verstreken`,`${stats.elapsedDays} of ${stats.tripDays} trip days elapsed`) : text("De prognose start op de vertrekdag.","The forecast starts on departure day.")}</p></div><strong>{formatMoney(stats.spent,base)}</strong></div><Progress value={trip.budget > 0 ? Math.min(100,(stats.spent/trip.budget)*100) : 0}/><div className="grid grid-cols-2 gap-3 text-sm"><Metric label={text("Resterend","Remaining")} value={formatMoney(stats.remaining,base)} danger={stats.remaining<0}/><Metric label={text("Prognose totaal","Projected total")} value={formatMoney(stats.projectedTotal,base)} danger={stats.projectedDifference<0}/></div></div>
        <Breakdown title={text("Uitgaven per categorie","Expenses by category")} empty={text("Voeg een uitgave toe om de verdeling te zien.","Add an expense to see the breakdown.")} rows={stats.categoryTotals.map(row=>({key:row.category,label:categoryName(row.category),value:`${formatMoney(row.amount,base)} · ${Math.round(row.percentage)}%`,percentage:row.percentage}))}/>
        <Breakdown title={text("Vervoersverdeling","Transport breakdown")} empty={text("Stel vervoer per etappe in of voeg een vervoersboeking toe om de verdeling te zien.","Set transport for each stage or add a transport booking to see the breakdown.")} rows={stats.transportTotals.map(row=>({key:row.mode,label:modeName(row.mode),value:row.distanceKm>0?`${row.count}× · ${Math.round(row.distanceKm)} km`:`${row.count}×`,percentage:stats.recordedDistanceKm>0?(row.distanceKm/stats.recordedDistanceKm)*100:0}))}/>
      </div>
      <p className="text-xs text-muted-foreground">{text("Afstanden per vervoersmiddel bevatten vastgelegde boekingsafstanden en geldige berekende wegetappes. Ontbrekende waarden worden niet ingevuld.", "Distances by transport mode include recorded booking distances and valid calculated road stages. Missing values are not invented.")}</p>
    </CardContent>
  </Card>;
}

function Insight({icon:Icon,label,value,detail}:{icon:typeof CalendarDays;label:string;value:string;detail?:string}){return <div className="rounded-xl border bg-background/50 p-4"><Icon className="mb-3 size-5 text-primary"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p>{detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>}
function Metric({label,value,danger}:{label:string;value:string;danger:boolean}){return <div className="rounded-xl bg-muted/50 p-3"><span className="text-xs text-muted-foreground">{label}</span><p className={danger?"font-semibold text-destructive":"font-semibold"}>{value}</p></div>}
function List({title,values}:{title:string;values:string[]}){return <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{values.join(" · ")}</p></div>}
function Breakdown({title,empty,rows}:{title:string;empty:string;rows:{key:string;label:string;value:string;percentage:number}[]}){return <div className="space-y-3"><p className="text-sm font-medium">{title}</p>{rows.length===0?<p className="text-sm text-muted-foreground">{empty}</p>:rows.map(row=><div key={row.key} className="space-y-1"><div className="flex justify-between gap-3 text-sm"><span>{row.label}</span><span>{row.value}</span></div>{row.percentage>0&&<Progress value={row.percentage}/>}</div>)}</div>}
