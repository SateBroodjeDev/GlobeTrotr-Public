import { CalendarCheck2, MapPin, Ticket } from "lucide-react";
import { isRoutePlanningItem, type Trip } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TripTasks } from "@/components/TripTasks";
import { WeatherWidget } from "@/components/WeatherWidget";
import { TripReadiness } from "@/components/TripReadiness";
import { FlightDisruptionCard } from "@/components/FlightDisruptionCard";
import { buildFlightConnections, flightStatusLevel } from "@/lib/flight-disruption";

export function TripToday({ trip, editable, weatherEnabled, text }: { trip: Trip; editable: boolean; weatherEnabled: boolean; text: (nl: string, en: string) => string }) {
  const today = new Date().toLocaleDateString("en-CA");
  const beforeTrip = today < trip.start;
  const afterTrip = today > trip.end;
  const planning = trip.itinerary.filter((item) => item.day === today);
  const bookedItems = (trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item));
  const bookings = bookedItems.filter((item) => item.date === today || (item.endDate && item.date <= today && item.endDate >= today));
  const flightConnections = buildFlightConnections(bookedItems);
  const disruptedFlights = bookings.filter((item) => item.type === "flight" && ["critical","warning"].includes(flightStatusLevel(item.flightStatus)));
  const stop = beforeTrip || afterTrip ? undefined : [...trip.stops].reverse().find((item) => Boolean(item.arrive) && item.arrive! <= today);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
    <div className="space-y-4">
      <Card className="surface"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck2 className="size-4"/>{text("Vandaag onderweg", "Today on the go")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{beforeTrip ? text(`Je reis begint op ${trip.start}.`, `Your trip starts on ${trip.start}.`) : afterTrip ? text(`Deze reis eindigde op ${trip.end}.`, `This trip ended on ${trip.end}.`) : new Intl.DateTimeFormat(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${today}T12:00:00`))}</p>
        {disruptedFlights.length>0&&<div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"><p className="text-sm font-semibold">{text(`${disruptedFlights.length} vlucht${disruptedFlights.length===1?"":"en"} vraagt aandacht`,`${disruptedFlights.length} flight${disruptedFlights.length===1?"":"s"} need attention`)}</p><p className="mt-1 text-xs text-muted-foreground">{text("Controleer hieronder de actuele tijd, gate en eventuele overstap voordat je vertrekt.","Check the current time, gate and any connection below before you leave.")}</p></div>}
        {stop && <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3"><MapPin className="mt-0.5 size-4 text-primary"/><div><p className="text-sm font-medium">{stop.name}</p><p className="text-xs text-muted-foreground">{stop.country}</p></div></div>}
        <section><h3 className="mb-2 text-sm font-semibold">{text("Planning", "Schedule")}</h3>{planning.length ? <div className="space-y-2">{planning.map((item)=><div key={item.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{item.title}</p>{item.notes&&<p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">{text("Voor vandaag staat nog geen dagplanning klaar.", "No schedule has been added for today.")}</p>}</section>
        <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Ticket className="size-4"/>{text("Boekingen", "Bookings")}</h3>{bookings.length ? <div className="space-y-2">{bookings.map((item)=>item.type === "flight" ? <FlightDisruptionCard key={item.id} item={item} connection={flightConnections.get(item.id)} text={text} compact/> : <div key={item.id} className="min-w-0 rounded-lg border p-3"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{[item.provider,item.departure?.name,item.location?.name,item.arrival?.name].filter(Boolean).join(" · ")}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{text("Geen boekingen voor vandaag.", "No bookings for today.")}</p>}</section>
      </CardContent></Card>
      <TripTasks tripId={trip.id} members={trip.members} editable={editable} text={text}/>
    </div>
    <div className="space-y-4"><WeatherWidget stop={stop} enabled={weatherEnabled}/><TripReadiness trip={trip} text={text}/><Card className="surface"><CardContent className="p-4 text-sm text-muted-foreground">{text("Tickets, bevestigingen en andere veilige bestanden vind je in Documenten.", "Find tickets, confirmations and other secure files under Documents.")}</CardContent></Card></div>
  </div>;
}
