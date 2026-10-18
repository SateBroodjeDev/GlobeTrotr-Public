import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Plane, Route } from "lucide-react";
import { toast } from "sonner";
import type { TransportMode, TravelItem, Trip } from "@/lib/types";
import { calculateTripRoadRoutes } from "@/lib/road-routing.functions";
import { roadRoutingMessage, roadSaveMessage } from "@/lib/road-routing-messages";
import { applyRoadSegments, routePlaceName, googleMapsDirectionsUrl, mapTripRouteLegs, routePlanFingerprint, setRouteLegMode } from "@/lib/route-map";
import { roadModeForTransport } from "@/lib/road-routing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Text = (nl: string, en: string) => string;
const MODES: Array<[TransportMode, string, string]> = [
  ["flight", "Vliegtuig", "Plane"], ["car", "Auto", "Car"], ["motorcycle", "Motor", "Motorcycle"],
  ["camper", "Camper", "Camper"], ["train", "Trein", "Train"], ["bus", "Bus", "Bus"],
  ["public_transport", "Openbaar vervoer", "Public transport"], ["ferry", "Veerboot", "Ferry"],
  ["taxi", "Taxi", "Taxi"], ["bicycle", "Fiets", "Bicycle"], ["walking", "Lopen", "Walking"], ["other", "Anders", "Other"],
];

export function TripRouteLegModes({ trip, editable, text, save, onEditBooking }: { onEditBooking?: (item: TravelItem) => void; trip: Trip; editable: boolean; text: Text; save: (update: (trip: Trip) => Trip) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number>();
  const [calculating, setCalculating] = useState(false);
  const items = trip.travelItems ?? [];
  const routeLegs = mapTripRouteLegs(trip);
  const incomplete = items.filter(item => !item.details?.routePlanningOnly && (item.type === "flight" || item.type === "transport") && (!item.departure || !item.arrival));
  if (!routeLegs.length && !incomplete.length) return null;
  const legs = routeLegs.length;
  const selected = routeLegs.filter(leg => leg.mode).length;
  const calculatedCount = routeLegs.filter(leg => leg.segment).length;
  const roadLegCount = routeLegs.filter(leg => roadModeForTransport(leg.mode)).length;

  async function setMode(index: number, mode?: TransportMode) {
    const { from, to } = routeLegs[index]!;
    setSavingIndex(index);
    try {
      await save(current => setRouteLegMode(current, from.id, to.id, mode));
    } catch {
      toast.error(text("De vervoerskeuze kon niet worden opgeslagen.", "The transport choice could not be saved."));
    } finally {
      setSavingIndex(undefined);
    }
  }

  async function calculate() {
    if (!roadLegCount) return;
    const fingerprint = routePlanFingerprint(trip);
    setCalculating(true);
    try {
      let result;
      try { result = await calculateTripRoadRoutes({ data: { tripId: trip.id } }); }
      catch (error) { toast.error(roadRoutingMessage(error, text)); return; }
      try {
        await save(current => {
          if (routePlanFingerprint(current) !== fingerprint) throw new Error("ROUTE_PLAN_CHANGED");
          return applyRoadSegments(current, result.segments);
        });
      } catch (error) { toast.error(roadSaveMessage(error, text)); return; }
      toast.success(text(`${result.segments.length} wegetappes opgeslagen.`, `${result.segments.length} road stages saved.`));
    } finally { setCalculating(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <section className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Route className="size-4" /></div>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm">{text("Vervoer tussen routepunten", "Travel between route points")}</strong>
          <p className="text-xs text-muted-foreground">{selected === legs
            ? text(`Alle ${legs} etappes ingesteld`, `All ${legs} stages configured`)
            : text(`${selected} van ${legs} etappes ingesteld`, `${selected} of ${legs} stages configured`)}</p>
        </div>
        <DialogTrigger asChild><Button type="button" size="sm" variant="outline">{text("Vervoer en navigatie", "Transport and navigation")}</Button></DialogTrigger>
        {editable && <Button type="button" size="sm" variant="outline" disabled={!roadLegCount || calculating || savingIndex !== undefined} onClick={() => void calculate()}>
          {calculating && <Loader2 className="size-4 animate-spin" />}{text("Wegen op kaart berekenen", "Calculate roads on map")}
        </Button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{text(`${calculatedCount} etappes met berekende wegroute. Andere vervoersmiddelen en etappes zonder keuze blijven gestippeld. Berekenen gebruikt routequotum.`, `${calculatedCount} stages with a calculated road route. Other modes and unconfigured stages remain dashed. Calculating uses routing quota.`)}</p>
      {!roadLegCount && editable && <p className="mt-1 text-xs text-muted-foreground">{text("Kies eerst auto, motor, camper, taxi, fiets of lopen voor minstens één etappe om wegen te berekenen.", "First choose car, motorcycle, camper, taxi, bicycle or walking for at least one stage to calculate roads.")}</p>}
    </section>
    <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
      <DialogHeader className="shrink-0">
        <DialogTitle>{text("Vervoer en navigatie", "Transport and navigation")}</DialogTitle>
        <DialogDescription>{text("Stel ook de ritten naar en vanaf je geboekte vertrek- en aankomstpunten in. Een geboekte vlucht blijft een vlucht. Er wordt geen automatische terugrit naar het beginpunt toegevoegd.", "Configure transfers to and from your booked departure and arrival points too. A booked flight stays a flight. No automatic drive back to the starting point is added.")}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 max-h-[60vh] flex-1 space-y-2 overflow-y-auto pr-1">
        {routeLegs.map(({ from, to, mode: current, bookingId }, index) => {
          const bookedFlight = items.some(item => item.id === bookingId && item.type === "flight");
          const navigationUrl = googleMapsDirectionsUrl(from, to, current);
          const busy = savingIndex === index;
          return <div key={`${from.id}:${to.id}`} className="grid items-center gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_210px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold">{index + 1}</span>
              <span className="min-w-0 truncate text-sm">{current === "flight" && <Plane className="mr-1 inline size-3.5" />}{routePlaceName(from)} → {routePlaceName(to)}</span>
              {current && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
            </div>
            <div className="relative">
              <select disabled={bookedFlight || !editable || calculating || savingIndex !== undefined} className="h-10 w-full rounded-md border bg-background px-3 pr-9 text-sm" value={current ?? ""} onChange={(event) => void setMode(index, event.target.value ? event.target.value as TransportMode : undefined)}>
                <option value="">{text("Nog niet gekozen", "Not selected yet")}</option>
                {MODES.map(([value, nl, en]) => <option key={value} value={value}>{text(nl, en)}</option>)}
              </select>
              {busy && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />}
            </div>
            {bookingId && <p className="text-xs text-muted-foreground sm:col-span-2">{items.find(item => item.id === bookingId)?.date} · {items.find(item => item.id === bookingId)?.title}{bookedFlight && text(" · Geboekte vlucht", " · Booked flight")}</p>}
            {navigationUrl && <Button asChild type="button" variant="ghost" size="sm" className="h-9 w-fit justify-self-start gap-1.5 px-2 text-xs text-muted-foreground sm:col-span-2 sm:h-7 [&_svg]:size-3">
              <a href={navigationUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={text(`Open ${from.name} naar ${to.name} in Google Maps`, `Open ${from.name} to ${to.name} in Google Maps`)}><ExternalLink className="size-3" />Google Maps</a>
            </Button>}
          </div>;
        })}
      </div>
      {incomplete.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="min-w-0 flex-1">{text(`Vul vertrek en aankomst in voor ${item.title}.`, `Add departure and arrival locations for ${item.title}.`)}</span>{editable && onEditBooking && <Button size="sm" variant="outline" onClick={() => { setOpen(false); onEditBooking(item); }}>{text("Locaties invullen", "Add locations")}</Button>}</div>)}
      {!editable && <p className="text-xs text-muted-foreground">{text("Alleen reisplanners kunnen vervoersmiddelen wijzigen.", "Only trip planners can change transport modes.")}</p>}
      <p className="text-xs text-muted-foreground">{text("Auto, motor, camper en taxi gebruiken het algemene autowegprofiel. Dit controleert geen voertuighoogte of andere voertuigbeperkingen.", "Car, motorcycle, camper and taxi use the general driving profile. This does not check vehicle height or other vehicle restrictions.")}</p>
      <p className="text-xs text-muted-foreground">{text("Google Maps ontvangt pas bij openen de vertrek- en aankomstcoördinaten en vervoerskeuze. Het berekent zelf een route; tijden, voertuigbeperkingen en OV kunnen afwijken van je planning. Voor vliegen, veerboot en onbekend vervoer bieden we geen navigatielink.", "Google Maps receives the departure and arrival coordinates and transport choice only when opened. It calculates its own route; times, vehicle restrictions and transit may differ from your plan. We offer no navigation link for flights, ferries or unknown transport.")}</p>
      <DialogFooter className="shrink-0"><Button type="button" onClick={() => setOpen(false)}>{text("Klaar", "Done")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
