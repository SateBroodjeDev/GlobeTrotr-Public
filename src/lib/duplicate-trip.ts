import type { TravelItem, Trip } from "./types.ts";
import { isRoutePlanningItem } from "./types.ts";
import { routeLegId } from "./route-map.ts";

export function duplicateTripName(name: string, copyLabel: string, maxLength = 30) {
  const suffix = ` (${copyLabel})`;
  return `${name.slice(0, Math.max(1, maxLength - suffix.length)).trimEnd()}${suffix}`;
}

export function buildTripDuplicate(source: Trip, target: Trip, makeId: () => string): Trip {
  const stops = source.stops.map((stop) => ({ ...stop, id: makeId() }));
  const stopIds = new Map(source.stops.map((stop, index) => [stop.id, stops[index]!.id]));
  const planningIds = new Map(source.stops.slice(0, -1).map((from, index) => [
    routeLegId(from.id, source.stops[index + 1]!.id), routeLegId(stops[index]!.id, stops[index + 1]!.id),
  ]));
  const travelIds = new Map<string, string>();
  const travelItems = (source.travelItems ?? []).flatMap((item): TravelItem[] => {
    const planning = isRoutePlanningItem(item);
    const id = planning ? planningIds.get(item.id) : makeId();
    if (!id) return [];
    travelIds.set(item.id, id);
    const details = item.details ? { ...item.details, fuelActualExpenseIds: undefined } : undefined;
    if (details) {
      for (const key of ["mapStopId", "routeDepartureStopId", "routeArrivalStopId"] as const) {
        if (details[key]) details[key] = stopIds.get(details[key]!) ?? "";
      }
    }
    if (planning && details) {
      delete details.roadRoute;
      delete details.distanceKm;
      delete details.durationMinutes;
      details.routePlanningOnly = true;
    }
    return [{
      ...item,
      id,
      bookingReference: undefined,
      expenseId: undefined,
      details,
    }];
  });
  return {
    ...source,
    id: target.id,
    ownerId: target.ownerId,
    revision: target.revision,
    accessRole: target.accessRole,
    stops,
    itinerary: source.itinerary.map((item) => ({
      ...item,
      id: makeId(),
      sourceTravelItemId: item.sourceTravelItemId
        ? travelIds.get(item.sourceTravelItemId)
        : undefined,
    })),
    travelItems,
    // Kandidaten en bronprijzen kunnen verouderd zijn en horen niet automatisch
    // bij een nieuwe reisversie. Gekozen onderdelen staan al in travelItems.
    travelOptions: [],
    expenses: [],
    members: [],
    travelers: [],
    packing: (source.packing ?? []).map((item) => ({ ...item, id: makeId(), done: false })),
    archived: false,
    public: false,
    shareFinancials: false,
    sharePinHash: undefined,
  };
}
