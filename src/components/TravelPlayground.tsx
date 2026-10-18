import { useId, useState } from "react";
import { BookHeart, MapPinned, Plus, RotateCcw, Wallet } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { directDistanceKm } from "@/lib/route-optimizer";
import { balances, settle } from "@/lib/settle";
import type { Stop, Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JournalStory, type StoryChapter } from "@/components/JournalStory";

type Scenario = "beach" | "citytrip" | "roadtrip";
const destinations: Record<Scenario, Stop[]> = {
  beach: [
    { id: "a", name: "Faro", country: "PT", lat: 37.0194, lon: -7.9322 },
    { id: "b", name: "Lagos", country: "PT", lat: 37.1028, lon: -8.673 },
    { id: "c", name: "Sagres", country: "PT", lat: 37.0079, lon: -8.939 },
  ],
  citytrip: [
    { id: "a", name: "Montmartre", country: "FR", lat: 48.8867, lon: 2.3431 },
    { id: "b", name: "Le Marais", country: "FR", lat: 48.8575, lon: 2.3622 },
    { id: "c", name: "Tour Eiffel", country: "FR", lat: 48.8584, lon: 2.2945 },
  ],
  roadtrip: [
    { id: "a", name: "Bologna", country: "IT", lat: 44.4949, lon: 11.3426 },
    { id: "b", name: "Firenze", country: "IT", lat: 43.7696, lon: 11.2558 },
    { id: "c", name: "Siena", country: "IT", lat: 43.3188, lon: 11.3308 },
  ],
};

export function TravelPlayground() {
  const { text } = useLocale();
  const [scenario, setScenario] = useState<Scenario>("beach");
  const labels = { beach: text("Zonvakantie", "Beach holiday"), citytrip: text("Stedentrip", "City break"), roadtrip: text("Roadtrip", "Road trip") };
  return <section className="mx-auto max-w-6xl space-y-6" aria-label={text("Probeer GlobeTrotr", "Try GlobeTrotr")}>
    <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{text("Zelf proberen, zonder account", "Try it yourself, no account needed")}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{text("Een reis wordt pas echt jouw reis als je ermee speelt.", "Make a trip your own. Try it here.")}</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{text("Voeg een plek toe, verdeel de kosten en schrijf het eerste hoofdstuk. Dit zijn voorbeeldreizen; je wijzigingen blijven alleen op deze pagina. Wisselen van reis begint opnieuw.", "Add a stop, split the costs and write your first chapter. These are sample trips; changes stay on this page only. Switching trips starts over.")}</p>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={text("Soort voorbeeldreis", "Sample trip type")}>{(Object.keys(labels) as Scenario[]).map((value) => <Button key={value} variant={scenario === value ? "default" : "outline"} aria-pressed={scenario === value} data-analytics-event={`demo_${value}`} onClick={() => setScenario(value)}>{labels[value]}</Button>)}</div>
    <PracticeTrip key={scenario} scenario={scenario} title={labels[scenario]} />
  </section>;
}

function PracticeTrip({ scenario, title }: { scenario: Scenario; title: string }) {
  const { text, locale } = useLocale();
  const id = useId();
  const [extraStop, setExtraStop] = useState(false);
  const [amount, setAmount] = useState("60");
  const [payer, setPayer] = useState("noor");
  const [memoryTitle, setMemoryTitle] = useState("");
  const [body, setBody] = useState("");
  const [chapter, setChapter] = useState<StoryChapter>();
  const stops = destinations[scenario].slice(0, extraStop ? 3 : 2);
  const distance = stops.slice(1).reduce((sum, stop, index) => sum + directDistanceKm(stops[index]!, stop), 0);
  const value = Number(amount);
  const validAmount = amount.trim() !== "" && Number.isFinite(value) && value > 0 && value <= 10000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
  const trip: Trip = { id: "demo", name: title, template: scenario, start: "2027-06-01", end: "2027-06-07", budget: 500, stops, itinerary: [], expenses: validAmount ? [{ id: "dinner", date: "2027-06-01", title: "Dinner", category: "food", currency: "EUR", amount: value, paidBy: payer, billable: false }] : [] };
  const transfers = settle(balances(trip, [{ id: "noor", name: "Noor" }, { id: "sam", name: "Sam" }], "EUR", { EUR: 1 }));
  const money = (price: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(price);
  function reset() { setExtraStop(false); setAmount("60"); setPayer("noor"); setMemoryTitle(""); setBody(""); setChapter(undefined); }
  return <div className="overflow-hidden rounded-[1.75rem] border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><span className="font-semibold">{title} · Noor &amp; Sam</span><Button variant="ghost" size="sm" data-analytics-event="demo_reset" onClick={reset}><RotateCcw className="size-4" />{text("Opnieuw", "Reset")}</Button></div>
    <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-2">
      <div className="min-w-0 space-y-8">
        <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><MapPinned className="size-5 text-primary" />{text("1. Maak de route", "1. Shape the route")}</h3>
          <ol className="space-y-2">{stops.map((stop, index) => <li key={stop.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3"><span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs text-primary">{index + 1}</span>{stop.name}</li>)}</ol>
          <p className="text-xs text-muted-foreground" aria-live="polite">{distance.toFixed(1)} km · {text("hemelsbreed; geen berekende wegroute", "straight-line distance; not a calculated road route")}</p>
          <Button variant="outline" aria-pressed={extraStop} data-analytics-event={extraStop ? "demo_remove_stop" : "demo_add_stop"} onClick={() => setExtraStop(!extraStop)}><Plus className="size-4" />{extraStop ? text("Extra stop verwijderen", "Remove extra stop") : `${text("Voeg toe", "Add")} ${destinations[scenario][2]!.name}`}</Button>
        </section>
        <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><Wallet className="size-5 text-primary" />{text("2. Verdeel het diner", "2. Split dinner")}</h3>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm" htmlFor={`${id}-amount`}>{text("Bedrag (EUR)", "Amount (EUR)")}<Input id={`${id}-amount`} type="number" min="0.01" max="10000" step="0.01" value={amount} aria-invalid={!validAmount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="space-y-1 text-sm" htmlFor={`${id}-payer`}>{text("Betaald door", "Paid by")}<select id={`${id}-payer`} value={payer} onChange={(event) => setPayer(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="noor">Noor</option><option value="sam">Sam</option></select></label></div>
          <p className="rounded-xl bg-primary/5 p-3 text-sm" aria-live="polite">{validAmount ? transfers.map((transfer) => `${transfer.from} → ${transfer.to}: ${money(transfer.amount)}`).join(" · ") || text("Geen overboeking nodig.", "No transfer needed.") : text("Vul een bedrag van 0,01 tot 10.000 in, met maximaal twee decimalen.", "Enter an amount from 0.01 to 10,000, with at most two decimal places.")}</p>
        </section>
        <form data-analytics-submit="demo_memory_preview" className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (memoryTitle.trim()) setChapter({ id: "memory", title: memoryTitle.trim(), body: body.trim(), date: "2027-06-01", location: stops[stops.length - 1]!.name, author: "Noor" }); }}>
          <h3 className="flex items-center gap-2 font-semibold"><BookHeart className="size-5 text-primary" />{text("3. Bewaar het moment", "3. Capture the moment")}</h3>
          <label className="block space-y-1 text-sm" htmlFor={`${id}-title`}>{text("Titel", "Title")}<Input id={`${id}-title`} value={memoryTitle} maxLength={160} placeholder={scenario === "beach" ? text("Die eerste avond aan zee", "That first evening by the sea") : scenario === "citytrip" ? text("Een ochtend in Parijs", "A morning in Paris") : text("Onderweg door Toscane", "On the road in Tuscany")} onChange={(event) => setMemoryTitle(event.target.value)} /></label>
          <label className="block space-y-1 text-sm" htmlFor={`${id}-body`}>{text("Jouw verhaal", "Your story")}<Textarea id={`${id}-body`} value={body} maxLength={2000} rows={3} onChange={(event) => setBody(event.target.value)} placeholder={text("Wat wil je later nog weten?", "What would you like to remember?")} /></label>
          <Button type="submit" disabled={!memoryTitle.trim()}>{chapter ? text("Voorbeeld bijwerken", "Update preview") : text("Bekijk mijn hoofdstuk", "Preview my chapter")}</Button>
          <p className="text-xs text-muted-foreground">{text("Alleen een voorbeeld op je scherm. Er wordt niets opgeslagen of gepubliceerd.", "A preview on your screen only. Nothing is stored or published.")}</p>
        </form>
      </div>
      <div className="min-w-0" aria-live="polite"><JournalStory title={title} entries={chapter ? [chapter] : [{ id: "sample", date: "2027-06-01", title: text("Hier begint ons verhaal", "Our story starts here"), location: stops[0]!.name, body: text("De koffers zijn uitgepakt. Tijd om de eerste plek te ontdekken. Schrijf links een herinnering en maak dit hoofdstuk van jezelf.", "Bags unpacked. Time to explore our first stop. Write a memory and make this chapter your own."), author: "Noor" }]} /></div>
    </div>
  </div>;
}
