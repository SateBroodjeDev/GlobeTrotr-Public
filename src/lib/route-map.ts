import type { CachedRoadSegment, Stop, TransportMode, TravelItem, TravelLocation, Trip } from "./types.ts";
import { isRoutePlanningItem } from "./types.ts";
import { roadModeForTransport } from "./road-routing.ts";
import { directDistanceKm } from "./route-optimizer.ts";

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
  });
}

/** Booked journeys can return to an existing place without adding a new stop.
 * Car hire describes vehicle availability, not a known driven itinerary. */
export function mapBookedRouteLegs(items: TravelItem[] = []) {
  const located = (place?: TravelLocation) => place && coordinate([place.lon, place.lat]) ? place : undefined;
  return items.filter(item => !isRoutePlanningItem(item) && (item.type === "flight" || item.type === "transport"))
    .map(item => ({
      item, mode: item.type === "flight" ? "flight" as const : item.details?.transportMode,
      departure: located(item.departure), arrival: located(item.arrival),
      departureName: item.departure?.name || item.details?.flightDepartureAirport,
      arrivalName: item.arrival?.name || item.details?.flightArrivalAirport,
    })).sort((a, b) => `${a.item.date}T${a.item.details?.startTime || ""}`.localeCompare(`${b.item.date}T${b.item.details?.startTime || ""}`) || a.item.id.localeCompare(b.item.id));
}

type RoutingTrip = Pick<Trip, "stops" | "travelItems"> & { start?: string };
export type TripRouteLeg = ReturnType<typeof mapRouteLegs>[number] & { bookingId?: string };
const samePlace = (a: TravelLocation, b: TravelLocation) => Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lon - b.lon) < 0.00001;

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
export const routePlaceName = (place: TravelLocation) => place.city || place.name;
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

/** Ignore old activity-only route insertions without deleting saved data. */
export function tripRouteStops(trip: RoutingTrip) {
  const activities = (trip.travelItems ?? []).filter(item => item.type === "activity" && item.location);
  const destinations = trip.stops.filter(stop => (stop.nights ?? 0) > 0 || !activities.some(item => samePlace(stop, item.location!)));
  const stops = trip.stops.filter(stop => (stop.nights ?? 0) > 0 || !activities.some(item =>
    samePlace(stop, item.location!) && activityDestination(item.location!, destinations.filter(candidate => candidate.id !== stop.id))));
  let day = trip.start || "";
  const dated = stops.map(stop => {
    day = stop.arrive || day;
    const visit = { stop, day };
    const end = new Date(`${day}T12:00:00Z`);
    if (Number.isFinite(end.getTime()) && Number.isFinite(stop.nights) && (stop.nights ?? 0) > 0) {
      end.setUTCDate(end.getUTCDate() + stop.nights!);
      day = end.toISOString().slice(0, 10);
    }
    return visit;
  });
  return dated.sort((a, b) => (a.day || "9999").localeCompare(b.day || "9999")).map(visit => visit.stop);
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
    const cityPlace = stop.city && places.find(place => placeKey(place.name) === placeKey(stop.city!) && directDistanceKm(place, stop) <= 30);
    (cityPlace || placeAt(stop, routePlaceName(stop)))?.stops.push({ stop, index });
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
export function mapTripRouteLegs(trip: RoutingTrip): TripRouteLeg[] {
  const items = trip.travelItems ?? [];
  const journeys = mapBookedRouteLegs(items);
  const routeStops = tripRouteStops(trip).filter(stop => !(stop.nights === 0 && !stop.arrive && journeys.some(leg =>
    (leg.departure && samePlace(stop, leg.departure)) || (leg.arrival && samePlace(stop, leg.arrival)))));
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
  const endpoint = (item: TravelItem, side: "departure" | "arrival", place: TravelLocation): Stop =>
    trip.stops.find(stop => samePlace(stop, place)) ?? { ...place, id: `booking:${item.id}:${side}`, nights: 0, arrive: side === "arrival" ? item.endDate ?? item.date : item.date };
  const add = (from: Stop, to: Stop, booking?: TravelItem) => {
    if (from.id === to.id || samePlace(from, to)) return;
    const id = routeLegId(from.id, to.id);
    const planned = items.find(item => item.id === id);
    const mode = booking?.type === "flight" ? "flight" : planned?.details?.transportMode ?? booking?.details?.transportMode;
    const segment = planned?.details?.roadRoute;
    result.set(id, { from, to, mode, segment: validRoadSegment(segment, from, to, mode) ? segment : undefined, ...(booking ? { bookingId: booking.id } : {}) });
  };
  for (const [index, { item, departure, arrival }] of journeys.entries()) {
    if (!departure || !arrival) continue;
    const from = endpoint(item, "departure", departure), to = endpoint(item, "arrival", arrival);
    const arrivalDay = item.endDate ?? item.details?.flightArrivalScheduled?.slice(0, 10) ?? item.date;
    const preceding = journeys[index - 1], following = journeys[index + 1];
    const connectsBefore = preceding?.arrival && samePlace(preceding.arrival, departure) && (preceding.item.endDate ?? preceding.item.date) === item.date;
    const connectsAfter = following?.departure && samePlace(arrival, following.departure) && following.item.date === arrivalDay;
    const prior = item.details?.routeDepartureStopId !== undefined
      ? trip.stops.find(stop => stop.id === item.details?.routeDepartureStopId)
      : connectsBefore ? undefined : dated.filter(visit => visit.date && visit.date <= item.date &&
        (visit.date < item.date || directDistanceKm(visit.stop, departure) <= directDistanceKm(visit.stop, arrival))).at(-1)?.stop;
    const next = item.details?.routeArrivalStopId !== undefined
      ? trip.stops.find(stop => stop.id === item.details?.routeArrivalStopId)
      : connectsAfter ? undefined : dated.find(visit => visit.date && visit.date >= arrivalDay &&
        directDistanceKm(visit.stop, arrival) < directDistanceKm(visit.stop, departure))?.stop;
    // A booked journey replaces a direct line between its linked destinations.
    if (prior && next) result.delete(routeLegId(prior.id, next.id));
    if (prior && connectsAfter) {
      let final = journeys[index]!;
      for (let cursor = index + 1; cursor < journeys.length; cursor++) {
        const connection = journeys[cursor]!;
        if (!final.arrival || !connection.departure || !samePlace(final.arrival, connection.departure)
          || (final.item.endDate ?? final.item.details?.flightArrivalScheduled?.slice(0, 10) ?? final.item.date) !== connection.item.date) break;
        final = connection;
      }
      const day = final.item.endDate ?? final.item.details?.flightArrivalScheduled?.slice(0, 10) ?? final.item.date;
      const destination = final.item.details?.routeArrivalStopId !== undefined
        ? trip.stops.find(stop => stop.id === final.item.details?.routeArrivalStopId)
        : dated.find(visit => visit.date && visit.date >= day && final.arrival && directDistanceKm(visit.stop, final.arrival) < directDistanceKm(visit.stop, departure))?.stop;
      if (destination) result.delete(routeLegId(prior.id, destination.id));
    }
    if (prior) add(prior, from);
    add(from, to, item);
    if (next) add(to, next);
  }
  const order = (leg: TripRouteLeg) => {
    const journey = leg.bookingId ? journeys.find(entry => entry.item.id === leg.bookingId) : journeys.find(entry =>
      entry.departure && samePlace(entry.departure, leg.to) && !leg.from.id.startsWith("booking:")
      || entry.arrival && samePlace(entry.arrival, leg.from) && !leg.to.id.startsWith("booking:"));
    const day = journey?.item.date || dated.find(visit => visit.stop.id === leg.from.id)?.date || leg.from.arrive || leg.to.arrive || "9999";
    const phase = leg.bookingId ? "1" : journey?.departure && samePlace(journey.departure, leg.to) ? "0" : "2";
    return `${day}T${journey?.item.details?.startTime || "24:00"}:${phase}`;
  };
  return [...result.values()].sort((a, b) => order(a).localeCompare(order(b)));
}

export function pruneRoutePlan(trip: Trip): Trip {
  const current = new Map(mapTripRouteLegs(trip).map(leg => [routeLegId(leg.from.id, leg.to.id), leg]));
  return { ...trip, travelItems: trip.travelItems?.flatMap(item => {
    if (!isRoutePlanningItem(item)) return [item];
    const leg = current.get(item.id);
    if (!leg) return [];
    if (!item.details?.roadRoute || leg.segment) return [item];
    const details = { ...item.details };
    delete details.roadRoute;
    delete details.distanceKm;
    delete details.durationMinutes;
    return [{ ...item, details }];
  }) };
}

/** The current trip is read inside the save updater to preserve other edits. */
export function setRouteLegMode(trip: Trip, fromId: string, toId: string, mode?: TransportMode): Trip {
  const leg = mapTripRouteLegs(trip).find(candidate => candidate.from.id === fromId && candidate.to.id === toId);
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
