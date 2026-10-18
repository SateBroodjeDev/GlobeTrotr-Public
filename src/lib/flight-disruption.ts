import type { TravelItem } from "./types";

export type FlightConnection = { nextFlightId: string; minutes: number; level: "critical" | "tight" | "comfortable" };
const timestamp = (value?: string) => { if (!value) return undefined; const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T")); return Number.isFinite(parsed) ? parsed : undefined; };
const airportCode = (value?: string) => value?.trim().toUpperCase().match(/\b[A-Z]{3}\b/)?.[0];
const airportIdentity = (codeValue?: string, nameValue?: string) => {
  const code = airportCode(codeValue) || airportCode(nameValue);
  if (code) return `code:${code}`;
  const name = (codeValue || nameValue)?.toLowerCase().replace(/\b(airport|luchthaven|international|internationale|flughafen|aeroport)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return name && name.length >= 4 && !/^(unknown|onbekend|n a|null)$/.test(name) ? `name:${name}` : undefined;
};

export function flightStatusLevel(status?: string) {
  const value = status?.trim().toLowerCase() ?? "";
  if (/cancel|divert|incident/.test(value)) return "critical" as const;
  if (/delay|late|unknown/.test(value)) return "warning" as const;
  if (/landed|arrived|active|en route|departed|scheduled|expected/.test(value)) return "normal" as const;
  return "neutral" as const;
}
export function flightDelayMinutes(item: TravelItem, side: "departure" | "arrival") {
  const details = item.details;
  const scheduled = timestamp(side === "departure" ? details?.flightDepartureScheduled : details?.flightArrivalScheduled);
  const current = timestamp(side === "departure" ? details?.flightDepartureActual : details?.flightArrivalEstimated);
  if (scheduled === undefined || current === undefined) return undefined;
  return Math.round((current - scheduled) / 60_000);
}
export function localizedFlightStatus(status: string | undefined, locale: "nl" | "en") {
  const value = status?.trim().toLowerCase() ?? "";
  const labels: Array<[RegExp, string, string]> = [[/cancel/,"Geannuleerd","Cancelled"],[/divert/,"Uitgeweken","Diverted"],[/delay|late/,"Vertraagd","Delayed"],[/landed|arrived/,"Geland","Landed"],[/active|en route/,"Onderweg","En route"],[/departed/,"Vertrokken","Departed"],[/scheduled/,"Gepland","Scheduled"]];
  const match = labels.find(([pattern]) => pattern.test(value));
  return match ? match[locale === "nl" ? 1 : 2] : status;
}
export function flightDataFreshness(item: TravelItem, now = Date.now()) {
  const checked = timestamp(item.details?.flightLastCheckedAt);
  if (checked === undefined) return "never" as const;
  const ageMinutes = Math.max(0, Math.round((now - checked) / 60_000));
  return ageMinutes <= 120 ? "fresh" as const : "stale" as const;
}
export function flightMoment(item: TravelItem, side: "departure" | "arrival") {
  const d = item.details;
  const value = side === "departure" ? d?.flightDepartureActual || d?.flightDepartureScheduled : d?.flightArrivalEstimated || d?.flightArrivalScheduled;
  if (value) return timestamp(value);
  const time = side === "departure" ? d?.startTime : d?.endTime;
  return timestamp(`${side === "arrival" && item.endDate ? item.endDate : item.date}T${time || (side === "departure" ? "00:00" : "23:59")}:00`);
}
export function buildFlightConnections(items: TravelItem[]) {
  const flights = items.filter((item) => item.type === "flight").map((item) => ({ item, departure: flightMoment(item, "departure"), arrival: flightMoment(item, "arrival") })).filter((flight) => flight.departure !== undefined).sort((a,b) => a.departure! - b.departure!);
  const result = new Map<string, FlightConnection>();
  for (let index=0; index<flights.length-1; index+=1) {
    const current=flights[index], next=flights[index+1];
    if (current.arrival === undefined || next.departure === undefined) continue;
    const arrivalAirport=airportIdentity(current.item.details?.flightArrivalAirport,current.item.arrival?.name);
    const departureAirport=airportIdentity(next.item.details?.flightDepartureAirport,next.item.departure?.name);
    if (!arrivalAirport || !departureAirport || arrivalAirport !== departureAirport) continue;
    const minutes=Math.round((next.departure-current.arrival)/60000);
    if (minutes<0 || minutes>720) continue;
    result.set(current.item.id,{nextFlightId:next.item.id,minutes,level:minutes<45?"critical":minutes<90?"tight":"comfortable"});
  }
  return result;
}
export function alternativeFlightsUrl(item: TravelItem) {
  const from=airportCode(item.details?.flightDepartureAirport)||airportCode(item.departure?.name);
  const to=airportCode(item.details?.flightArrivalAirport)||airportCode(item.arrival?.name);
  const query=[from&&`from ${from}`,to&&`to ${to}`,item.date&&`on ${item.date}`].filter(Boolean).join(" ");
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query || item.flightNumber || item.title)}`;
}
