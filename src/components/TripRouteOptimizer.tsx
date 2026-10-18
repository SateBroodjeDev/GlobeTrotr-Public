import { useState } from "react";
import { Loader2, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import type { Stop, Trip } from "@/lib/types";
import { calculateRoadRoute } from "@/lib/road-routing.functions";
import type { RoadRouteLeg, RoadRouteProposal, RoadTravelMode } from "@/lib/road-routing";
import { roadRoutingMessage, roadSaveMessage } from "@/lib/road-routing-messages";
import { applyRoadProposal, routePlanFingerprint } from "@/lib/route-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Props = { trip: Trip; text: (nl: string, en: string) => string; save: (update: (trip: Trip) => Trip) => Promise<unknown> };
function distance(value: number) { return `${Math.round(value).toLocaleString()} km`; }
function duration(value: number) { const rounded = Math.round(value), hours = Math.floor(rounded / 60), minutes = rounded % 60; return `${hours ? `${hours}h ` : ""}${minutes}m`; }

export function TripRouteOptimizer({ trip, text, save }: Props) {
  const { stops } = trip;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [calculating, setCalculating] = useState(false);
  const [preview, setPreview] = useState<{ proposal: RoadRouteProposal; fingerprint: string }>();
  const [mode, setMode] = useState<RoadTravelMode>("car"), [avoidTolls, setAvoidTolls] = useState(false), [avoidFerries, setAvoidFerries] = useState(false), [restEveryMinutes, setRestEveryMinutes] = useState(120);
  const [startIndex, setStartIndex] = useState(0), [endIndex, setEndIndex] = useState(Math.min(stops.length - 1, 199));
  const fromIndex = Math.min(startIndex, Math.max(0, stops.length - 2));
  const throughIndex = Math.min(Math.max(1, endIndex), stops.length - 1);
  const selectedStops = stops.slice(Math.min(fromIndex, throughIndex), Math.max(fromIndex, throughIndex) + 1);
  const proposal = preview?.proposal;
  const stale = !!preview && preview.fingerprint !== routePlanFingerprint(trip);
  function changed() { setPreview(undefined); }

  async function calculate() {
    if (selectedStops.length > 200) { toast.error(text("Kies maximaal 200 routepunten.", "Select at most 200 route points.")); return; }
    const fingerprint = routePlanFingerprint(trip);
    setCalculating(true);
    setPreview(undefined);
    try {
      const result = await calculateRoadRoute({ data: { tripId: trip.id, stopIds: selectedStops.map(stop => stop.id), mode, avoidTolls, avoidFerries, restEveryMinutes } });
      setPreview({ proposal: result, fingerprint });
    } catch (error) { toast.error(roadRoutingMessage(error, text)); }
    finally { setCalculating(false); }
  }

  async function apply() {
    if (!preview || stale) return;
    setBusy(true);
    try {
      await save(current => applyRoadProposal(current, preview.fingerprint, preview.proposal.original, preview.proposal.proposed, preview.proposal.proposedRoadSegments));
      setOpen(false);
      setPreview(undefined);
      toast.success(text("Wegroute opgeslagen en op de kaart bijgewerkt.", "Road route saved and updated on the map."));
    } catch (error) { toast.error(roadSaveMessage(error, text)); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setPreview(undefined); }}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={stops.length < 2}><RouteIcon className="size-4" />{text("Route verbeteren", "Improve route")}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>{text("Route over echte wegen", "Route on real roads")}</DialogTitle><DialogDescription>{text("Bereken maximaal 200 routepunten via OpenRouteService. Ingestelde vervoersmiddelen worden gevolgd; vlieg-, trein- en veerbootstukken worden overgeslagen. Het begin en einde van elk wegdeel blijven staan. Bekijk het voorstel voordat je het toepast.", "Calculate up to 200 route points through OpenRouteService. Selected transport modes are respected; flights, trains and ferries are skipped. Each road section keeps its start and end. Review the proposal before applying it.")}</DialogDescription></DialogHeader>
      <fieldset disabled={calculating || busy} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <label className="space-y-2"><Label>{text("Wegdeel vanaf", "Road section from")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={fromIndex} onChange={event => { setStartIndex(Number(event.target.value)); changed(); }}>{stops.slice(0, -1).map((stop, index) => <option key={stop.id} value={index}>{index + 1}. {stop.name}</option>)}</select></label>
        <label className="space-y-2"><Label>{text("Wegdeel tot en met", "Road section through")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={throughIndex} onChange={event => { setEndIndex(Number(event.target.value)); changed(); }}>{stops.slice(1).map((stop, index) => <option key={stop.id} value={index + 1}>{index + 2}. {stop.name}</option>)}</select></label>
        <label className="space-y-2"><Label>{text("Vervoer voor etappes zonder keuze", "Transport for unconfigured stages")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={mode} onChange={event => { const value = event.target.value as RoadTravelMode; setMode(value); if (value !== "car") setAvoidTolls(false); changed(); }}><option value="car">{text("Auto", "Car")}</option><option value="bicycle">{text("Fiets", "Bicycle")}</option><option value="walking">{text("Lopen", "Walking")}</option></select></label>
        <label className="space-y-2"><Label>{text("Rustmoment voorstellen", "Suggest breaks")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={restEveryMinutes} onChange={event => { setRestEveryMinutes(Number(event.target.value)); changed(); }}><option value={0}>{text("Geen", "None")}</option>{[90, 120, 150, 180].map(minutes => <option value={minutes} key={minutes}>{text(`Iedere ${duration(minutes)}`, `Every ${duration(minutes)}`)}</option>)}</select></label>
        <Toggle label={text("Tolwegen vermijden bij autoroutes", "Avoid toll roads on driving stages")} checked={avoidTolls} change={value => { setAvoidTolls(value); changed(); }} />
        <Toggle label={text("Veerboten vermijden op wegtrajecten", "Avoid ferries on road stages")} checked={avoidFerries} change={value => { setAvoidFerries(value); changed(); }} />
        <p className="sm:col-span-2 text-xs text-muted-foreground">{text("Berekenen gebruikt routequotum. Motor, camper en taxi gebruiken het algemene autowegprofiel zonder voertuigbeperkingen.", "Calculating uses routing quota. Motorcycle, camper and taxi use the general driving profile without vehicle restrictions.")}</p>
        <div className="sm:col-span-2"><Button onClick={() => void calculate()} disabled={calculating || selectedStops.length < 2}>{calculating ? <Loader2 className="size-4 animate-spin" /> : <RouteIcon className="size-4" />}{calculating ? text("Wegroute berekenen…", "Calculating road route…") : text("Toon voor- en na-preview", "Show before and after preview")}</Button></div>
      </fieldset>
      {proposal && <>
        {stale && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{text("De route of vervoerskeuzes zijn gewijzigd. Bereken een nieuw voorstel.", "The route or transport choices changed. Calculate a new proposal.")}</p>}
        <div className="grid gap-4 md:grid-cols-2"><RouteList text={text} title={text("Huidige route", "Current route")} stops={proposal.original} legs={proposal.originalLegs} /><RouteList text={text} title={text("Voorgestelde route", "Proposed route")} stops={proposal.proposed} legs={proposal.proposedLegs} /></div>
        {proposal.skippedLegs.length > 0 && <p className="rounded-xl bg-muted p-3 text-sm">{text(`${proposal.skippedLegs.length} etappes met ander vervoer blijven ongewijzigd en tellen niet mee in de wegafstand.`, `${proposal.skippedLegs.length} stages using other transport remain unchanged and are excluded from the road distance.`)}</p>}
        {proposal.changed ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><strong>{text("Berekende besparing", "Calculated saving")}</strong><p className="mt-1 text-muted-foreground">{distance(proposal.savedDistanceKm)} · {duration(proposal.savedDurationMinutes)}</p></div>
          : <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{text("Dit voorstel verbetert de huidige volgorde niet. Je kunt de berekende wegtrajecten wel op de kaart opslaan.", "This proposal does not improve the current order. You can still save the calculated road stages on the map.")}</p>}
        {proposal.restStops.length > 0 && <section className="rounded-xl border p-4"><strong>{text("Voorgestelde rustmomenten", "Suggested breaks")}</strong><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{proposal.restStops.map((stop, index) => <li key={`${stop.afterStopId}-${stop.afterMinutes}-${index}`}>{stop.label} · {text(`na ongeveer ${duration(stop.afterMinutes)}`, `after about ${duration(stop.afterMinutes)}`)}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">{text("Dit zijn planningsmomenten. Kies onderweg een veilige, toegestane stopplaats.", "These are planning moments. Choose a safe, permitted stopping place while travelling.")}</p></section>}
        <p className="text-xs text-muted-foreground">{text(`Berekend via OpenRouteService in ${proposal.providerRequestCount} verzoek(en). Kaartgegevens © OpenStreetMap-bijdragers.`, `Calculated through OpenRouteService in ${proposal.providerRequestCount} request(s). Map data © OpenStreetMap contributors.`)} <a className="underline" href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer">OpenRouteService</a></p>
      </>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{text("Annuleren", "Cancel")}</Button><Button disabled={!proposal?.proposedRoadSegments.length || stale || busy || calculating} onClick={() => void apply()}>{busy ? text("Opslaan…", "Saving…") : proposal?.changed ? text("Voorstel toepassen", "Apply proposal") : text("Wegroute opslaan", "Save road route")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Toggle({ label, checked, change }: { label: string; checked: boolean; change: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><Label>{label}</Label><Switch checked={checked} onCheckedChange={change} /></div>;
}
function RouteList({ title, stops, legs, text }: { title: string; stops: Stop[]; legs: RoadRouteLeg[]; text: Props["text"] }) {
  return <section className="rounded-xl border p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><strong>{title}</strong><span className="text-xs text-muted-foreground">{distance(legs.reduce((sum, leg) => sum + leg.distanceKm, 0))} · {duration(legs.reduce((sum, leg) => sum + leg.durationMinutes, 0))}</span></div><ol className="space-y-2 text-sm">{stops.map((stop, index) => {
    const from = stops[index - 1], leg = from && legs.find(candidate => candidate.fromStopId === from.id && candidate.toStopId === stop.id);
    return <li key={stop.id} className="flex gap-2"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs">{index + 1}</span><span className="min-w-0 break-words">{stop.name}{index > 0 && <small className="block text-muted-foreground">{leg ? `${distance(leg.distanceKm)} · ${duration(leg.durationMinutes)}` : text("Ander vervoer · geen wegafstand", "Other transport · no road distance")}</small>}</span></li>;
  })}</ol></section>;
}
