import type { CachedRoadSegment, Stop, TransportMode, TravelItem, TravelLocation, Trip } from "./types.ts";
import { isRoutePlanningItem } from "./types.ts";
import { roadModeForTransport } from "./road-routing.ts";
import { directDistanceKm } from "./route-optimizer.ts";
import { countryCode } from "./countries.ts";

export const routeLegId = (fromId: string, toId: string) => `route-leg:${fromId}:${toId}`;

/** An explicit external handoff, containing coordinates and mode only. */
export function googleMapsDirectionsUrl(from: Pick<TravelLocation, "lat" | "lon">, to: Pick<TravelLocation, "lat" | "lon">, mode?: TransportMode) {
  const modes: Partial<Record<TransportMode, string>> = {
    car: "driving", taxi: "driving", camper: "driving", motorcycle: "two-wheeler",
    walking: "walking", bicycle: "bicycling", train: "transit", bus: "transit", public_transport: "transit",
  };
  const travelmode = mode && modes[mode];
  if (!travelmode || !coordinate([from.lon, from.lat]) || !coordinate([to.lon, to.lat])) return undefined;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({ api: "1", origin: `${from.lat},${from.lon}`, destination: `${to.lat},${to.lon}`, travelmode, dir_action: "navigate" }).toString();
  return url.toString();
}

export function routePlanFingerprint(trip: Pick<Trip, "stops" | "travelItems"> & { start?: string }) {
  return JSON.stringify(mapTripRouteLegs(trip).map(({ from, to, mode }) => [from.id, from.lon, from.lat, to.id, to.lon, to.lat, mode]));
}

function coordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function hasMapCoordinates(place: Pick<TravelLocation, "lat" | "lon"> | undefined) {
  return !!place && coordinate([place.lon, place.lat]);
}

export function validRoadSegment(segment: CachedRoadSegment | undefined, from: Stop, to: Stop, mode?: TransportMode) {
  return !!segment && !!roadModeForTransport(mode) && segment.source === "openrouteservice" && segment.mode === roadModeForTransport(mode)
    && segment.fromStopId === from.id && segment.toStopId === to.id
    && coordinate(segment.from) && coordinate(segment.to)
    && segment.from[0] === from.lon && segment.from[1] === from.lat
    && segment.to[0] === to.lon && segment.to[1] === to.lat
    && Array.isArray(segment.coordinates) && segment.coordinates.length >= 2 && segment.coordinates.length <= 1024
    && segment.coordinates.every(coordinate) && Number.isFinite(segment.distanceKm) && segment.distanceKm >= 0
    && Number.isFinite(segment.durationMinutes) && segment.durationMinutes >= 0
    && typeof segment.calculatedAt === "string" && Number.isFinite(Date.parse(segment.calculatedAt))
    && typeof segment.avoidTolls === "boolean" && typeof segment.avoidFerries === "boolean";
}

export function mapRouteLegs(stops: Stop[], items: TravelItem[] = []) {
  const byId = new Map(items.map(item => [item.id, item]));
  return stops.slice(0, -1).map((from, index) => {
    const to = stops[index + 1]!, item = byId.get(routeLegId(from.id, to.id));
    const mode = item?.details?.transportMode ?? (item?.type === "flight" ? "flight" : undefined);
    const segment = item?.details?.roadRoute;
    return { from, to, mode, segment: validRoadSegment(segment, from, to, mode) ? segment : undefined };
  }).filter(leg => hasMapCoordinates(leg.from) && hasMapCoordinates(leg.to));
}

/** Booked journeys can return to an existing place without adding a new stop.
 * Car hire describes vehicle availability, not a known driven itinerary. */
export function mapBookedRouteLegs(items: TravelItem[] = []) {
  const located = (place?: TravelLocation) => place && coordinate([place.lon, place.lat]) ? place : undefined;
  const bookedPlace = (item: TravelItem, side: "departure" | "arrival") => {
    const place = located(item[side]);
    const airport = side === "departure" ? item.details?.flightDepartureAirport : item.details?.flightArrivalAirport;
    // The flight's airport label is not the reverse-geocoded municipality.
    // This changes presentation only; the booked coordinates remain untouched.
    return place && item.type === "flight" && airport?.trim() && !/^[a-z]{3}$/i.test(airport.trim())
      ? { ...place, name: airport.trim() } : place;
  };
  return items.filter(item => !isRoutePlanningItem(item) && (item.type === "flight" || item.type === "transport"))
    .map(item => ({
      item, mode: item.type === "flight" ? "flight" as const : item.details?.transportMode,
      departure: bookedPlace(item, "departure"), arrival: bookedPlace(item, "arrival"),
      departureName: item.departure?.name || item.details?.flightDepartureAirport,
      arrivalName: item.arrival?.name || item.details?.flightArrivalAirport,
    })).sort((a, b) => `${a.item.date}T${a.item.details?.startTime || ""}`.localeCompare(`${b.item.date}T${b.item.details?.startTime || ""}`) || a.item.id.localeCompare(b.item.id));
}

type RoutingTrip = Pick<Trip, "stops" | "travelItems"> & { start?: string };
export type TripRouteLeg = ReturnType<typeof mapRouteLegs>[number] & { bookingId?: string };

/** Shared endpoints may represent multiple actual journeys, but one road stage
 * needs only one provider calculation for each routing profile. */
export function distinctRouteLegsForCalculation(legs: TripRouteLeg[]) {
  const seen = new Set<string>();
  const profiles = new Map<string, string>();
  return legs.filter(leg => {
    const stage = routeLegId(leg.from.id, leg.to.id), profile = roadModeForTransport(leg.mode);
    if (profile && profiles.has(stage) && profiles.get(stage) !== profile) throw new Error("ROUTE_STAGE_MODES_CONFLICT");
    if (profile) profiles.set(stage, profile);
    const key = JSON.stringify([leg.from.id, leg.to.id, roadModeForTransport(leg.mode) ?? leg.mode ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
const samePlace = (a: TravelLocation, b: TravelLocation) => Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lon - b.lon) < 0.00001;

/** Compare known place identities conservatively. A station/airport and its
 * municipality are separate destinations, even when their city metadata agrees.
 * Identity is used for rendering only; no saved locations are merged. */
export function sameRouteEndpoint(a: TravelLocation, b: TravelLocation) {
  if (samePlace(a, b)) return true;
  if (!hasMapCoordinates(a) || !hasMapCoordinates(b) || directDistanceKm(a, b) > 5) return false;
  if (a.country && b.country && (countryCode(a.country) ?? a.country.toLowerCase()) !== (countryCode(b.country) ?? b.country.toLowerCase())) return false;
  const words = (name: string): string[] => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const airport = /^(airport|luchthaven|flygplats|flughafen|aeroport|aeropuerto|schiphol|arlanda)$/;
  const generic = /^(airport|luchthaven|flygplats|flughafen|aeroport|aeropuerto|international|internationaal|intl|the|of)$/;
  const venue = /^(hotel|hotell|rental|parking|parkeren|museum|restaurant|hostel)$/;
  const left = words(a.name), right = words(b.name);
  if (left.some(word => venue.test(word)) || right.some(word => venue.test(word))) return false;
  const category = (tokens: string[]) => tokens.some(word => /^(bus|busstation|busstop|bushalte|coach|busbahnhof)$/.test(word)) ? "bus"
    : tokens.some(word => /^(ferry|veerboot|veerhaven|ferryport)$/.test(word)) ? "ferry"
    : tokens.some(word => /^(station|treinstation|railway|train|gare|bahnhof|hauptbahnhof|hbf|centralstation|centralen|centraal|central|cs|c)$/.test(word)) ? "station"
    : tokens.some(word => airport.test(word)) ? "airport" : "place";
  const leftCategory = category(left), rightCategory = category(right);
  if (leftCategory !== rightCategory) return false;
  if (leftCategory === "station") {
    if (directDistanceKm(a, b) > 0.75) return false;
    const identity = (tokens: string[]) => tokens.flatMap(word => {
      if (/^(centralstation|centralen|centraal|central|cs|c|hauptbahnhof|hbf)$/.test(word)) return ["central"];
      if (/^(station|treinstation|railway|train|gare|bahnhof|de|du|la|the)$/.test(word)) return [];
      return [word];
    }).filter((word, index, tokens) => tokens.indexOf(word) === index).sort();
    const leftStation = identity(left), rightStation = identity(right);
    return leftStation.some(word => word !== "central") && leftStation.join(" ") === rightStation.join(" ");
  }
  if (leftCategory === "place") {
    if (directDistanceKm(a, b) > 1) return false;
    const identity = (place: TravelLocation) => {
      // Search providers sometimes append a country to a city label. Remove it
      // only when the existing country recognizer confirms that exact suffix.
      const parts = place.name.split(",");
      const suffix = parts.length === 2 ? countryCode(parts[1]) : undefined;
      const name = suffix && suffix === countryCode(place.country) ? parts[0] : place.name;
      return words(name).join(" ");
    };
    const name = identity(a);
    return name.length > 0 && name === identity(b);
  }
  // Do not guess bus/ferry terminal aliases from a shared city name. They need
  // their own verified identity contract; an actual transfer remains visible.
  if (leftCategory !== "airport") return false;
  if (!left.some(word => airport.test(word)) || !right.some(word => airport.test(word))) return false;
  const cities = new Set([...words(a.city ?? ""), ...words(b.city ?? "")]);
  const leftIdentity = left.filter(word => !generic.test(word)), rightIdentity = right.filter(word => !generic.test(word));
  return left.some(word => word.length >= 3 && !generic.test(word)
    && (!cities.has(word) || /^(schiphol|arlanda)$/.test(word) || (leftIdentity.length === 1 && rightIdentity.length === 1))
    && right.includes(word));
}

export type TripMapPoint = { id: string; lat: number; lon: number; title: string; detail?: string; locationName?: string; city?: string; routeStopId?: string; separate?: boolean; category?: "lodging" | "activity" | "other"; date?: string; startTime?: string; kind: "booking" | "expense" | "journal" };

export function bookingMapGrouping(item: TravelItem, stops: Stop[]) {
  if (item.type !== "activity" && item.type !== "lodging") return {};
  const choice = item.details?.mapStopId;
  if (choice !== undefined) return choice && stops.some(stop => stop.id === choice)
    ? { routeStopId: choice } : { separate: true };
  const location = item.location ?? item.departure ?? item.arrival;
  return location
    ? { city: item.type === "activity" ? activityPlaceName(location, stops) : location.city } : {};
}

export type TripMapFilters = { route: boolean; lodging: boolean; activity: boolean; other: boolean };
export function visibleMapPoints(points: TripMapPoint[], filters: TripMapFilters) {
  return points.filter(point => filters[point.category ?? "other"]);
}

const placeKey = (name: string) => name.trim().toLocaleLowerCase();
// A municipality is address metadata, not a replacement for the chosen venue.
export const routePlaceName = (place: TravelLocation) => place.name || place.city || "";
export function activityPlaceName(location: TravelLocation, stops: Stop[]) {
  const destination = activityDestination(location, stops);
  return location.city || (destination ? routePlaceName(destination) : undefined);
}

/** Legacy activity locations lack municipality data. Associate only activities
 * with a nearby existing destination; never infer airport/transport endpoints. */
export function activityDestination(location: TravelLocation, stops: Stop[]) {
  const candidates = stops.filter(stop => stop.name !== location.name && coordinate([stop.lon, stop.lat]) && directDistanceKm(stop, location) <= 15);
  const named = candidates.find(stop => placeKey(routePlaceName(stop)) === placeKey(location.city ?? "")
    || location.addressLine?.split(/[·,]/).some(part => placeKey(part) === placeKey(routePlaceName(stop))));
  if (location.city) return named;
  return named ?? candidates.sort((a, b) => directDistanceKm(a, location) - directDistanceKm(b, location))[0];
}

/** Editable destination order follows persisted positions, not arrival dates. */
export function tripDestinationStops(trip: RoutingTrip) {
  const activities = (trip.travelItems ?? []).filter(item => item.type === "activity" && item.location);
  const destinations = trip.stops.filter(stop => (stop.nights ?? 0) > 0 || !activities.some(item => samePlace(stop, item.location!)));
  return trip.stops.filter(stop => (stop.nights ?? 0) > 0 || !activities.some(item =>
    samePlace(stop, item.location!) && activityDestination(item.location!, destinations.filter(candidate => candidate.id !== stop.id))));
}

/** Shared by the actual add/delete handlers and their map lifecycle checks. */
export function insertTripDestination(trip: Trip, stop: Stop, position = trip.stops.length): Trip {
  const stops = [...trip.stops];
  stops.splice(Math.max(0, Math.min(position, stops.length)), 0, stop);
  return pruneRoutePlan({ ...trip, stops });
}

export function removeTripDestination(trip: Trip, stopId: string): Trip {
  if (!trip.stops.some(stop => stop.id === stopId)) return trip;
  return pruneRoutePlan({ ...trip, stops: trip.stops.filter(stop => stop.id !== stopId) });
}

/** Edit one visit's calendar date, preserving its identity, order and nights.
 * A dialog opened before another date edit must not overwrite that edit. */
export function updateTripDestinationDate(trip: Trip, stopId: string, arrive: string, expectedDate: string | undefined): Trip {
  const stop = trip.stops.find(value => value.id === stopId);
  if (!stop || (stop.arrive || "") !== (expectedDate || "")) throw new Error("DESTINATION_DATE_CONFLICT");
  if (arrive && (!/^\d{4}-\d{2}-\d{2}$/.test(arrive) || !Number.isFinite(Date.parse(`${arrive}T12:00:00Z`))
    || new Date(`${arrive}T12:00:00Z`).toISOString().slice(0, 10) !== arrive)) throw new Error("DESTINATION_DATE_INVALID");
  if ((stop.arrive || "") === arrive) return trip;
  return pruneRoutePlan({ ...trip, stops: trip.stops.map(value => value.id === stopId ? { ...value, arrive: arrive || undefined } : value) });
}

/** Move between visible neighbours, retaining hidden legacy activities and dates. */
export function moveTripDestination(trip: Trip, stopId: string, direction: -1 | 1): Trip {
  const destinations = tripDestinationStops(trip);
  const from = destinations.findIndex(stop => stop.id === stopId);
  const neighbour = destinations[from + direction];
  if (from < 0 || !neighbour) return trip;
  return reorderTripDestination(trip, stopId, neighbour.id);
}

/** Drop in the current visible order; hidden legacy rows keep their slots. */
export function reorderTripDestination(trip: Trip, stopId: string, targetId: string): Trip {
  const destinations = tripDestinationStops(trip);
  const from = destinations.findIndex(stop => stop.id === stopId);
  const to = destinations.findIndex(stop => stop.id === targetId);
  if (from < 0 || to < 0 || from === to) return trip;
  const ordered = [...destinations];
  ordered.splice(to, 0, ordered.splice(from, 1)[0]!);
  const visibleIds = new Set(destinations.map(stop => stop.id));
  let index = 0;
  const stops = trip.stops.map(stop => visibleIds.has(stop.id) ? ordered[index++]! : stop);
  return pruneRoutePlan({ ...trip, stops });
}

/** The map follows the same persisted destination order as the editable list.
 * Arrival dates belong to the calendar; moving a destination never rewrites them. */
export function tripRouteStops(trip: RoutingTrip) {
  return tripDestinationStops(trip);
}

/** Known booking days are display context, never stored date repairs. */
export function destinationBookingDays(trip: RoutingTrip) {
  const dates = new Map<string, Set<string>>();
  const items = new Map((trip.travelItems ?? []).map(item => [item.id, item]));
  for (const leg of mapTripRouteLegs(trip)) {
    const item = leg.bookingId ? items.get(leg.bookingId) : undefined;
    if (!item) continue;
    for (const [id, day] of [[leg.from.id, item.date], [leg.to.id, item.endDate || item.details?.flightArrivalScheduled?.slice(0, 10) || item.date]]) {
      if (!dates.has(id)) dates.set(id, new Set());
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
        && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day) dates.get(id)!.add(day);
    }
  }
  return new Map([...dates].filter(([, days]) => days.size > 0).map(([id, days]) => [id, [...days].sort()]));
}

/** A single day can prefill the editor; several days require an explicit choice. */
export function destinationBookingDates(trip: RoutingTrip) {
  return new Map([...destinationBookingDays(trip)].flatMap(([id, days]) => days.length === 1 ? [[id, days[0]] as const] : []));
}
export type TripMapPlace = {
  lat: number; lon: number; name: string;
  stops: Array<{ stop: Stop; index: number }>;
  routePoints: Stop[];
  points: TripMapPoint[];
};

/** Combine known municipalities within 30 km, otherwise only colocated markers.
 * A 25 m tolerance accommodates rounding; itinerary visits stay intact. */
export function groupTripMapPlaces(stops: Stop[], routePoints: Stop[], points: TripMapPoint[]): TripMapPlace[] {
  const places: TripMapPlace[] = [];
  const placeAt = (point: { lat: number; lon: number }, name: string) => {
    if (!coordinate([point.lon, point.lat])) return undefined;
    let place = places.find(candidate => directDistanceKm(candidate, point) <= 0.025);
    if (!place) {
      place = { ...point, name, stops: [], routePoints: [], points: [] };
      places.push(place);
    }
    return place;
  };
  stops.forEach((stop, index) => {
    if (!hasMapCoordinates(stop)) return;
    placeAt(stop, routePlaceName(stop))?.stops.push({ stop, index });
  });
  routePoints.forEach(point => {
    const place = placeAt(point, point.name);
    if (place && !place.routePoints.some(existing => existing.id === point.id)) place.routePoints.push(point);
  });
  points.forEach(point => {
    if (!coordinate([point.lon, point.lat])) return;
    const linkedPlace = point.routeStopId && places.find(place => place.stops.some(visit => visit.stop.id === point.routeStopId));
    const cityPlace = !point.separate && point.city && places.find(place => placeKey(place.name) === placeKey(point.city!) && directDistanceKm(place, point) <= 30);
    const ownPlace = point.separate && places.find(place => !place.stops.length && !place.routePoints.length && place.name === (point.locationName || point.title) && directDistanceKm(place, point) <= 0.025);
    const place = point.separate ? ownPlace || { lat: point.lat, lon: point.lon, name: point.locationName || point.title, stops: [], routePoints: [], points: [] } as TripMapPlace
      : linkedPlace || cityPlace || placeAt(point, point.city || point.locationName || point.title);
    if (point.separate && !places.includes(place!)) places.push(place!);
    if (place && !place.points.some(existing => existing.id === point.id)) place.points.push(point);
  });
  places.forEach(place => place.points.sort((a, b) => `${a.date || "9999"}T${a.startTime || "24:00"}`.localeCompare(`${b.date || "9999"}T${b.startTime || "24:00"}`)));
  return places;
}

/** Bookings retain their actual endpoints, including repeated visits on return.
 * Access/arrival transfers are distinct editable stages; no automatic trip closure. */
const bookedArrivalDay = (item: TravelItem) => item.endDate ?? item.details?.flightArrivalScheduled?.slice(0, 10) ?? item.date;
function orderedBookedJourneys(journeys: ReturnType<typeof mapBookedRouteLegs>) {
  const outgoing = journeys.map((left, index) => journeys.flatMap((right, next) => {
    if (index === next || !left.arrival || !right.departure || !sameRouteEndpoint(left.arrival, right.departure)
      || bookedArrivalDay(left.item) !== right.item.date) return [];
    const end = left.item.details?.endTime || left.item.details?.flightArrivalScheduled?.slice(11, 16);
    const start = right.item.details?.startTime || right.item.details?.flightDepartureScheduled?.slice(11, 16);
    if (end && start && end > start) return [];
    return [next];
  }));
  const incoming = journeys.map((_, index) => outgoing.flatMap((next, prior) => next.includes(index) ? [prior] : []));
  const next = outgoing.map(candidates => candidates.length === 1 && incoming[candidates[0]].length === 1 ? candidates[0] : undefined);
  const visited = new Set<number>(), ordered: typeof journeys = [];
  const append = (start: number) => {
    let index: number | undefined = start;
    while (index !== undefined && !visited.has(index)) {
      visited.add(index); ordered.push(journeys[index]); index = next[index];
    }
  };
  journeys.forEach((_, index) => { if (!next.some(value => value === index)) append(index); });
  journeys.forEach((_, index) => { if (!visited.has(index)) append(index); });
  return ordered;
}

export function mapTripRouteLegs(trip: RoutingTrip): TripRouteLeg[] {
  const items = trip.travelItems ?? [];
  // Incomplete bookings remain available for review, but cannot connect other
  // journeys or suppress their transfers. Manual airport points keep their slots.
  const journeys = orderedBookedJourneys(mapBookedRouteLegs(items).filter(leg => leg.departure && leg.arrival));
  const routeStops = tripRouteStops(trip);
  const positions = new Map(routeStops.map((stop, index) => [stop.id, index]));
  const journeyRanks = new Map<string, number>();
  const journeyByLeg = new Map<string, string>();
  const position = (stop: Stop | undefined, offset = 0) => {
    const index = stop && positions.get(stop.id);
    return index === undefined ? undefined : index + offset;
  };
  const result = new Map<string, TripRouteLeg>(mapRouteLegs(routeStops, items).map(leg => [routeLegId(leg.from.id, leg.to.id), leg]));
  let date = trip.start ?? trip.stops.find(stop => stop.arrive)?.arrive ?? "";
  const dated = routeStops.map(stop => {
    date = stop.arrive ?? date;
    const visit = { stop, date };
    if (date && Number.isFinite(stop.nights) && (stop.nights ?? 0) > 0) {
      const end = new Date(`${date}T12:00:00Z`);
      if (Number.isFinite(end.getTime())) { end.setUTCDate(end.getUTCDate() + stop.nights!); date = end.toISOString().slice(0, 10); }
    }
    return visit;
  });
  // Old dates are not evidence for a transfer hundreds of kilometres away.
  // Automatic attachment is local (80 km maximum) and chooses the nearest
  // route place only; longer/custom transfers require the existing explicit link.
  // Repeated colocated visits retain their separate route IDs. Prefer a usable
  // explicit visit date; otherwise arrival uses the first visit, departure the
  // last. Never inherit a different destination's date to invent a transfer.
  const localVisit = (place: TravelLocation, day: string, side: "departure" | "arrival", forEndpoint = false) => {
    let nearby = routeStops.filter(hasMapCoordinates).map(stop => ({ stop, km: directDistanceKm(stop, place) }))
      .filter(candidate => candidate.km <= 80);
    if (!nearby.length) return undefined;
    // A single legacy airport row is an endpoint, not the traveller's stay.
    // Repeated explicit route visits still use their individual route positions.
    const exact = nearby.filter(candidate => sameRouteEndpoint(candidate.stop, place));
    if (exact.length && exact.some(candidate => !samePlace(candidate.stop, place))) nearby = exact;
    const stays = nearby.filter(candidate => candidate.stop.arrive || (candidate.stop.nights ?? 0) > 0);
    if (!forEndpoint && exact.length === 1 && !exact[0].stop.arrive && !exact[0].stop.nights && stays.length) nearby = stays;
    const nearest = Math.min(...nearby.map(candidate => candidate.km));
    const visits = nearby.filter(candidate => candidate.km <= nearest + 0.025).map(candidate => candidate.stop);
    const datedVisits = visits.filter(stop => stop.arrive && (side === "departure" ? stop.arrive <= day : stop.arrive >= day))
      .sort((a, b) => a.arrive!.localeCompare(b.arrive!));
    return side === "departure" ? datedVisits.at(-1) ?? visits.at(-1) : datedVisits[0] ?? visits[0];
  };
  const arrivalDate = bookedArrivalDay;
  const endpoint = (item: TravelItem, side: "departure" | "arrival", place: TravelLocation): Stop => {
    const choice = side === "departure" ? item.details?.routeDepartureStopId : item.details?.routeArrivalStopId;
    const selected = choice ? routeStops.find(stop => stop.id === choice && sameRouteEndpoint(stop, place)) : undefined;
    const local = localVisit(place, side === "arrival" ? arrivalDate(item) : item.date, side, true);
    const visit = selected ?? (local && sameRouteEndpoint(local, place) ? local : undefined);
    return { ...place, id: visit?.id ?? `booking:${item.id}:${side}`, nights: 0, arrive: side === "arrival" ? arrivalDate(item) : item.date };
  };
  const add = (from: Stop, to: Stop, booking?: TravelItem, journeyId = booking?.id) => {
    if (!hasMapCoordinates(from) || !hasMapCoordinates(to) || from.id === to.id || sameRouteEndpoint(from, to)) return;
    const id = routeLegId(from.id, to.id);
    const planned = items.find(item => item.id === id);
    const mode = booking?.type === "flight" ? "flight" : planned?.details?.transportMode ?? booking?.details?.transportMode;
    const segment = planned?.details?.roadRoute;
    if (booking) result.delete(id);
    else if ([...result.values()].some(leg => leg.bookingId && leg.from.id === from.id && leg.to.id === to.id)) return;
    const key = booking ? `booking:${booking.id}` : id;
    result.set(key, { from, to, mode, segment: validRoadSegment(segment, from, to, mode) ? segment : undefined, ...(booking ? { bookingId: booking.id } : {}) });
    if (journeyId) journeyByLeg.set(key, journeyId);
  };
  for (const [index, { item, departure, arrival }] of journeys.entries()) {
    if (!departure || !arrival) continue;
    const from = endpoint(item, "departure", departure), to = endpoint(item, "arrival", arrival);
    const arrivalDay = arrivalDate(item);
    const preceding = journeys[index - 1], following = journeys[index + 1];
    const connectsBefore = preceding?.arrival && sameRouteEndpoint(preceding.arrival, departure) && arrivalDate(preceding.item) === item.date;
    const connectsAfter = following?.departure && sameRouteEndpoint(arrival, following.departure) && following.item.date === arrivalDay;
    const prior = item.details?.routeDepartureStopId !== undefined
      ? trip.stops.find(stop => stop.id === item.details?.routeDepartureStopId)
      : connectsBefore ? undefined : localVisit(departure, item.date, "departure");
    const next = item.details?.routeArrivalStopId !== undefined
      ? trip.stops.find(stop => stop.id === item.details?.routeArrivalStopId)
      : connectsAfter ? undefined : localVisit(arrival, arrivalDay, "arrival");
    // A return to an earlier unique route point belongs after the stay, not at
    // that airport's outbound position. Explicit repeated visit IDs still work.
    const fromPosition = position(from), toPosition = position(to);
    const returning = fromPosition !== undefined && toPosition !== undefined && fromPosition > toPosition;
    const rank = returning ? routeStops.length : position(prior) ?? position(next, -1) ?? fromPosition ?? position(to, -1);
    if (rank !== undefined) journeyRanks.set(item.id, rank);
    // A booked journey replaces a direct line between its linked destinations.
    if (prior && next) result.delete(routeLegId(prior.id, next.id));
    // Likewise replace a shortcut to/from a manually listed airport when the
    // booking already provides that connection through its actual endpoints.
    if (prior) result.delete(routeLegId(prior.id, to.id));
    if (next) result.delete(routeLegId(from.id, next.id));
    if (prior && connectsAfter) {
      let final = journeys[index]!;
      for (let cursor = index + 1; cursor < journeys.length; cursor++) {
        const connection = journeys[cursor]!;
        if (!final.arrival || !connection.departure || !sameRouteEndpoint(final.arrival, connection.departure)
          || arrivalDate(final.item) !== connection.item.date) break;
        final = connection;
      }
      const day = arrivalDate(final.item);
      const destination = final.item.details?.routeArrivalStopId !== undefined
        ? trip.stops.find(stop => stop.id === final.item.details?.routeArrivalStopId)
        : final.arrival ? localVisit(final.arrival, day, "arrival") : undefined;
      if (destination) result.delete(routeLegId(prior.id, destination.id));
    }
    if (prior) add(prior, from, undefined, item.id);
    add(from, to, item);
    if (next) add(to, next, undefined, item.id);
  }
  // A connecting itinerary shares one position between destinations. Its actual
  // departure dates still order the flights/transfers within that position.
  let chainStart = 0;
  for (let index = 0; index < journeys.length; index++) {
    const current = journeys[index], next = journeys[index + 1];
    if (next && current.arrival && next.departure && sameRouteEndpoint(current.arrival, next.departure)
      && arrivalDate(current.item) === next.item.date) continue;
    const chain = journeys.slice(chainStart, index + 1);
    const rank = chain.map(journey => journeyRanks.get(journey.item.id)).find(value => value !== undefined);
    if (rank !== undefined) chain.forEach(journey => journeyRanks.set(journey.item.id, rank));
    chainStart = index + 1;
  }
  const order = (key: string, leg: TripRouteLeg) => {
    const journeyId = journeyByLeg.get(key);
    const journey = journeys.find(entry => entry.item.id === journeyId);
    const day = journey?.item.date || dated.find(visit => visit.stop.id === leg.from.id)?.date || leg.from.arrive || leg.to.arrive || "9999";
    const phase = leg.bookingId ? "1" : journey?.departure && sameRouteEndpoint(journey.departure, leg.to) ? "0" : "2";
    const rank = journeyId ? journeyRanks.get(journeyId) : positions.get(leg.from.id);
    const sequence = journey ? String(journeys.indexOf(journey)).padStart(6, "0") : "999999";
    return { rank: rank ?? Infinity, time: `${day}T${sequence}:${phase}` };
  };
  return [...result.entries()].sort(([aKey, a], [bKey, b]) => {
    const left = order(aKey, a), right = order(bKey, b);
    return left.rank !== right.rank ? (left.rank < right.rank ? -1 : 1) : left.time.localeCompare(right.time);
  }).map(([, leg]) => leg);
}

export function pruneRoutePlan(trip: Trip): Trip {
  const current = new Map<string, TripRouteLeg[]>();
  for (const leg of mapTripRouteLegs(trip)) {
    const id = routeLegId(leg.from.id, leg.to.id);
    const matching = current.get(id) ?? [];
    matching.push(leg);
    current.set(id, matching);
  }
  return { ...trip, travelItems: trip.travelItems?.flatMap(item => {
    if (!isRoutePlanningItem(item)) return [item];
    const matching = current.get(item.id);
    if (!matching) return [];
    if (!item.details?.roadRoute || matching.some(leg => leg.segment)) return [item];
    const details = { ...item.details };
    delete details.roadRoute;
    delete details.distanceKm;
    delete details.durationMinutes;
    return [{ ...item, details }];
  }) };
}

/** The current trip is read inside the save updater to preserve other edits. */
export function setRouteLegMode(trip: Trip, fromId: string, toId: string, mode?: TransportMode): Trip {
  const candidates = mapTripRouteLegs(trip).filter(candidate => candidate.from.id === fromId && candidate.to.id === toId);
  const leg = candidates.find(candidate => !trip.travelItems?.some(item => item.id === candidate.bookingId && item.type === "flight")) ?? candidates[0];
  if (!leg) throw new Error("ROUTE_PLAN_CHANGED");
  const { from, to } = leg;
  if (leg.bookingId && trip.travelItems?.some(item => item.id === leg.bookingId && item.type === "flight") && mode !== "flight") throw new Error("BOOKED_FLIGHT_MODE_FIXED");
  const id = routeLegId(fromId, toId), remaining = (trip.travelItems ?? []).filter(item => item.id !== id);
  if (!mode) return { ...trip, travelItems: remaining };
  const existing = trip.travelItems?.find(item => item.id === id);
  const details = { ...(existing?.details ?? {}), transportMode: mode, routePlanningOnly: true };
  delete details.roadRoute;
  delete details.distanceKm;
  delete details.durationMinutes;
  const item: TravelItem = { ...existing, id, type: mode === "flight" ? "flight" : "transport",
    title: `${from.name} → ${to.name}`, date: to.arrive ?? from.arrive ?? trip.start,
    departure: { name: from.name, country: from.country, lat: from.lat, lon: from.lon },
    arrival: { name: to.name, country: to.country, lat: to.lat, lon: to.lon }, details };
  return { ...trip, travelItems: [...remaining, item] };
}

/** Store only genuine provider geometry on current adjacent stages. */
export function applyRoadSegments(trip: Trip, segments: CachedRoadSegment[], allowUnconfigured = false): Trip {
  const seen = new Set<string>();
  let result = trip;
  for (const segment of segments) {
    const leg = mapTripRouteLegs(result).find(candidate => candidate.from.id === segment.fromStopId && candidate.to.id === segment.toStopId);
    if (!leg) throw new Error("ROUTE_PLAN_CHANGED");
    const { from, to } = leg;
    const id = routeLegId(from.id, to.id);
    if (seen.has(id)) throw new Error("ROUTING_RESPONSE_INVALID");
    seen.add(id);
    const existingMode = leg.mode;
    const mode = existingMode ?? (allowUnconfigured ? segment.mode : undefined);
    if (!validRoadSegment(segment, from, to, mode)) throw new Error("ROUTE_PLAN_CHANGED");
    result = setRouteLegMode(result, from.id, to.id, mode);
    result = { ...result, travelItems: result.travelItems!.map(item => item.id !== id ? item : {
      ...item, details: { ...item.details, roadRoute: segment, distanceKm: segment.distanceKm, durationMinutes: segment.durationMinutes },
    }) };
  }
  return pruneRoutePlan(result);
}

export function applyRoadProposal(trip: Trip, fingerprint: string, original: Stop[], proposed: Stop[], segments: CachedRoadSegment[]): Trip {
  if (routePlanFingerprint(trip) !== fingerprint) throw new Error("ROUTE_PLAN_CHANGED");
  const start = trip.stops.findIndex(stop => stop.id === original[0]?.id);
  const currentById = new Map(trip.stops.map(stop => [stop.id, stop]));
  const originalIds = new Set(original.map(stop => stop.id));
  if (start < 0 || original.length < 2 || originalIds.size !== original.length || proposed.length !== original.length
    || new Set(proposed.map(stop => stop.id)).size !== original.length
    || original.some((stop, index) => trip.stops[start + index]?.id !== stop.id)
    || proposed.some(stop => !originalIds.has(stop.id))) throw new Error("ROUTE_PLAN_CHANGED");
  const stops = [...trip.stops];
  stops.splice(start, original.length, ...proposed.map(stop => currentById.get(stop.id)!));
  return applyRoadSegments({ ...trip, stops }, segments, true);
}
