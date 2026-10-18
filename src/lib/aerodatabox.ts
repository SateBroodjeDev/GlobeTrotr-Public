export type AeroDataBoxMoment = { local?: string; utc?: string };
export type AeroDataBoxAirport = { name?: string; iata?: string; icao?: string; location?: { lat?: number; lon?: number } };
export type AeroDataBoxMovement = {
  airport?: AeroDataBoxAirport;
  scheduledTime?: AeroDataBoxMoment;
  revisedTime?: AeroDataBoxMoment;
  actualTime?: AeroDataBoxMoment;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  baggageBelt?: string;
};
export type AeroDataBoxFlight = {
  number?: string;
  status?: string;
  airline?: { name?: string; iata?: string; icao?: string };
  departure?: AeroDataBoxMovement;
  arrival?: AeroDataBoxMovement;
};

export type NormalizedFlight = {
  flightNumber: string;
  airline?: string;
  status?: string;
  departure?: { airport?: string; airportFull?: string; location?: { name: string; country: string; lat: number; lon: number }; scheduled?: string; actual?: string; terminal?: string; gate?: string; checkin?: string };
  arrival?: { airport?: string; airportFull?: string; location?: { name: string; country: string; lat: number; lon: number }; scheduled?: string; estimated?: string; terminal?: string; gate?: string; baggage?: string };
};

const clean = (value?: string) => value?.trim() || undefined;
const moment = (value?: AeroDataBoxMoment) => clean(value?.local) ?? clean(value?.utc);
const airportLocation = (airport?: AeroDataBoxAirport) => {
  const lat = airport?.location?.lat, lon = airport?.location?.lon;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { name: clean(airport?.name) ?? clean(airport?.iata) ?? "Airport", country: "", lat, lon };
};

export function selectAeroDataBoxFlight(payload: unknown, departureIata?: string, requestedDate?: string) {
  if (!Array.isArray(payload)) return undefined;
  const flights = payload.filter((item): item is AeroDataBoxFlight => {
    if (!item || typeof item !== "object") return false;
    if (!requestedDate) return true;
    const departure = (item as AeroDataBoxFlight).departure?.scheduledTime;
    const timestamp = departure?.local ?? departure?.utc;
    return timestamp?.slice(0, 10) === requestedDate;
  });
  const iata = departureIata?.trim().toUpperCase();
  return (iata ? flights.find((flight) => flight.departure?.airport?.iata?.toUpperCase() === iata) : undefined) ?? flights[0];
}

export function normalizeAeroDataBoxFlight(payload: unknown, requestedNumber: string, departureIata?: string, requestedDate?: string): NormalizedFlight | undefined {
  const flight = selectAeroDataBoxFlight(payload, departureIata, requestedDate);
  if (!flight) return undefined;
  const departure = flight.departure;
  const arrival = flight.arrival;
  return {
    flightNumber: clean(flight.number) ?? requestedNumber,
    airline: clean(flight.airline?.name) ?? clean(flight.airline?.iata) ?? clean(flight.airline?.icao),
    status: clean(flight.status),
    departure: departure ? {
      airport: clean(departure.airport?.iata) ?? clean(departure.airport?.icao),
      airportFull: clean(departure.airport?.name),
      location: airportLocation(departure.airport),
      scheduled: moment(departure.scheduledTime),
      actual: moment(departure.actualTime) ?? moment(departure.revisedTime),
      terminal: clean(departure.terminal), gate: clean(departure.gate), checkin: clean(departure.checkInDesk),
    } : undefined,
    arrival: arrival ? {
      airport: clean(arrival.airport?.iata) ?? clean(arrival.airport?.icao),
      airportFull: clean(arrival.airport?.name),
      location: airportLocation(arrival.airport),
      scheduled: moment(arrival.scheduledTime),
      estimated: moment(arrival.revisedTime) ?? moment(arrival.actualTime),
      terminal: clean(arrival.terminal), gate: clean(arrival.gate), baggage: clean(arrival.baggageBelt),
    } : undefined,
  };
}

export function aeroDataBoxUrl(host: string, flightNumber: string, flightDate?: string) {
  if (host !== "aerodatabox.p.rapidapi.com") throw new Error("AERODATABOX_HOST_INVALID");
  const path = `/flights/number/${encodeURIComponent(flightNumber)}${flightDate ? `/${encodeURIComponent(flightDate)}` : ""}`;
  const query = new URLSearchParams({ withLocation: "true", withAircraftImage: "false" });
  if (flightDate) query.set("dateLocalRole", "Departure");
  return `https://${host}${path}?${query.toString()}`;
}
