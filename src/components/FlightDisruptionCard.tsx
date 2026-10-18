import { AlertTriangle, Clock3, ExternalLink, Plane, RefreshCw } from "lucide-react";
import type { TravelItem } from "@/lib/types";
import { alternativeFlightsUrl, flightDataFreshness, flightDelayMinutes, flightStatusLevel, localizedFlightStatus, type FlightConnection } from "@/lib/flight-disruption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

const clock=(value?:string)=>value?.match(/[T ](\d{2}:\d{2})/)?.[1];
export function FlightDisruptionCard({item,connection,text,compact=false,onRefresh,refreshing=false}:{item:TravelItem;connection?:FlightConnection;text:(nl:string,en:string)=>string;compact?:boolean;onRefresh?:()=>void;refreshing?:boolean}) {
  const {locale}=useLocale();
  const d=item.details,level=flightStatusLevel(item.flightStatus);
  const freshness=flightDataFreshness(item);
  const departureDelay=flightDelayMinutes(item,"departure"),arrivalDelay=flightDelayMinutes(item,"arrival");
  const departureTime=clock(d?.flightDepartureActual)||clock(d?.flightDepartureScheduled)||d?.startTime;
  const arrivalTime=clock(d?.flightArrivalEstimated)||clock(d?.flightArrivalScheduled)||d?.endTime;
  const from=d?.flightDepartureAirport||item.departure?.name||text("Vertrek onbekend","Departure unknown");
  const to=d?.flightArrivalAirport||item.arrival?.name||text("Aankomst onbekend","Arrival unknown");
  const statusClass=level==="critical"?"border-destructive/40 bg-destructive/10":level==="warning"?"border-amber-500/40 bg-amber-500/10":"";
  const delayLabel=(minutes?:number)=>minutes===undefined||Math.abs(minutes)<5?undefined:minutes>0?text(`${minutes} min vertraging`,`${minutes} min delayed`):text(`${Math.abs(minutes)} min eerder`,`${Math.abs(minutes)} min early`);
  const join=(values:Array<string|undefined|false>)=>values.filter(Boolean).join(" · ");
  return <div className={`rounded-xl border p-3 ${statusClass}`}>
    <div className="flex flex-wrap items-center gap-2"><Plane className="size-4 shrink-0"/><span className="font-medium">{item.flightNumber||item.title}</span>{item.flightStatus&&<Badge variant="outline">{localizedFlightStatus(item.flightStatus,locale.startsWith("nl")?"nl":"en")}</Badge>}{freshness==="stale"&&<Badge variant="secondary">{text("Controle verouderd","Check outdated")}</Badge>}</div>
    <div className={`mt-2 grid gap-2 text-xs ${compact?"":"sm:grid-cols-2"}`}>
      <div><span className="font-medium">{text("Vertrek","Departure")}</span><p className="text-muted-foreground">{join([from,departureTime,d?.flightDepartureTerminal&&`Terminal ${d.flightDepartureTerminal}`,d?.flightDepartureGate&&`Gate ${d.flightDepartureGate}`,d?.flightDepartureCheckin&&`${text("Incheck","Check-in")} ${d.flightDepartureCheckin}`])}</p>{delayLabel(departureDelay)&&<p className="mt-1 font-medium text-amber-700 dark:text-amber-300">{delayLabel(departureDelay)}</p>}</div>
      <div><span className="font-medium">{text("Aankomst","Arrival")}</span><p className="text-muted-foreground">{join([to,arrivalTime,d?.flightArrivalTerminal&&`Terminal ${d.flightArrivalTerminal}`,d?.flightArrivalGate&&`Gate ${d.flightArrivalGate}`,d?.flightArrivalBaggage&&`${text("Bagageband","Baggage belt")} ${d.flightArrivalBaggage}`])}</p>{delayLabel(arrivalDelay)&&<p className="mt-1 font-medium text-amber-700 dark:text-amber-300">{delayLabel(arrivalDelay)}</p>}</div>
    </div>
    {connection&&<div className={`mt-3 flex gap-2 rounded-lg p-2 text-xs ${connection.level==="critical"?"bg-destructive/15":connection.level==="tight"?"bg-amber-500/15":"bg-muted/60"}`}><AlertTriangle className="mt-0.5 size-4 shrink-0"/><span>{connection.level==="critical"?text(`Waarschijnlijk te weinig overstaptijd: ${connection.minutes} minuten. Controleer direct alternatieven.`,`Likely insufficient connection time: ${connection.minutes} minutes. Check alternatives now.`):connection.level==="tight"?text(`Krappe overstap: ${connection.minutes} minuten. Controleer terminal en gate.`,`Tight connection: ${connection.minutes} minutes. Check terminal and gate.`):text(`Overstaptijd: ${connection.minutes} minuten.`,`Connection time: ${connection.minutes} minutes.`)}</span></div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3"/>{d?.flightLastCheckedAt?text(`AeroDataBox gecontroleerd ${new Date(d.flightLastCheckedAt).toLocaleString()}`,`AeroDataBox checked ${new Date(d.flightLastCheckedAt).toLocaleString()}`):text("Nog niet live gecontroleerd","Not checked live yet")}</span><div className="flex flex-wrap gap-2">{onRefresh&&<Button type="button" size="sm" variant="ghost" className="h-8" disabled={refreshing} onClick={onRefresh}><RefreshCw className={`mr-1 size-3 ${refreshing?"animate-spin":""}`}/>{text("Opnieuw controleren","Check again")}</Button>}{(level==="critical"||level==="warning"||(connection&&connection.level!=="comfortable"))&&<Button asChild size="sm" variant="outline" className="h-8"><a href={alternativeFlightsUrl(item)} target="_blank" rel="noopener noreferrer">{text("Alternatieven zoeken","Find alternatives")}<ExternalLink className="ml-1 size-3"/></a></Button>}</div></div>
  </div>;
}
