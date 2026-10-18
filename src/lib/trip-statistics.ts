import type { ExpenseCategory, TravelItem, Trip } from "./types.ts";
import { isRoutePlanningItem } from "./types.ts";
import { mapTripRouteLegs, routeLegId } from "./route-map.ts";
import { findTripHotelGaps } from "./hotel-gaps.ts";

export type TripCategoryTotal = { category: ExpenseCategory; amount: number; percentage: number };
export type TripTransportTotal = { mode: string; count: number; distanceKm: number };

export type TripStatistics = {
  countries: number;
  countryNames: string[];
  destinations: number;
  placeNames: string[];
  nights: number;
  bookedNights: number;
  missingNights: number;
  tripDays: number;
  elapsedDays: number;
  spent: number;
  remaining: number;
  dailyAverage: number;
  projectedTotal: number;
  projectedDifference: number;
  categoryTotals: TripCategoryTotal[];
  transportTotals: TripTransportTotal[];
  recordedDistanceKm: number;
};

const dayNumber = (value: string) => {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? Math.floor(timestamp / 86_400_000) : undefined;
};

function bookedTransportMode(item: TravelItem) {
  return item.type === "flight" ? "flight" : item.type === "car_rental" ? "car"
    : item.type === "transport" ? item.details?.transportMode ?? "other" : undefined;
}

function transportStageKey(mode: string, date: string, from?: { lat: number; lon: number }, to?: { lat: number; lon: number }) {
  return from && to && [from.lat, from.lon, to.lat, to.lon].every(Number.isFinite)
    ? JSON.stringify([mode, date, from.lat, from.lon, to.lat, to.lon]) : undefined;
}

export function calculateTripStatistics(
  trip: Trip,
  convertExpense: (amount: number, currency: string) => number,
  today = new Date(),
): TripStatistics {
  const start = dayNumber(trip.start);
  const end = dayNumber(trip.end);
  const current = dayNumber(today.toISOString().slice(0, 10));
  const tripDays = start !== undefined && end !== undefined && end >= start ? end - start + 1 : 0;
  const nights = Math.min(366, Math.max(0, tripDays - 1));
  const missingNights = nights > 0 ? findTripHotelGaps(trip).reduce((sum, gap) => sum + gap.nights, 0) : 0;
  const elapsedDays = start === undefined || current === undefined || tripDays === 0
    ? 0
    : Math.max(0, Math.min(tripDays, current - start + 1));
  const totals = new Map<ExpenseCategory, number>();
  const transport = new Map<string, { count: number; distanceKm: number }>();
  let spent = 0;
  for (const expense of trip.expenses) {
    const converted = convertExpense(expense.amount, expense.currency);
    if (!Number.isFinite(converted)) continue;
    spent += converted;
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + converted);
  }
  const dailyAverage = elapsedDays > 0 ? spent / elapsedDays : 0;
  const projectedTotal = elapsedDays > 0 && elapsedDays < tripDays ? dailyAverage * tripDays : spent;
  const bookedStages = new Map<string, boolean>();
  for (const item of (trip.travelItems ?? []).filter(item => !isRoutePlanningItem(item))) {
    const mode = bookedTransportMode(item);
    if (!mode) continue;
    const currentMode = transport.get(mode) ?? { count: 0, distanceKm: 0 };
    const distance = Number(item.details?.distanceKm);
    const recordedDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
    transport.set(mode, { count: currentMode.count + 1, distanceKm: currentMode.distanceKm + recordedDistance });
    const stage = transportStageKey(mode, item.date, item.departure, item.arrival);
    if (stage) bookedStages.set(stage, Boolean(bookedStages.get(stage) || recordedDistance > 0));
  }
  const planningItems = (trip.travelItems ?? []).filter(isRoutePlanningItem);
  const planningById = new Map(planningItems.map(item => [item.id, item]));
  for (const { from, to, mode, segment } of mapTripRouteLegs(trip)) {
    const planned = planningById.get(routeLegId(from.id, to.id));
    if (!mode || !planned) continue;
    const stage = transportStageKey(mode, planned.date, from, to)!;
    const currentMode = transport.get(mode) ?? { count: 0, distanceKm: 0 };
    const booked = bookedStages.has(stage);
    // A planning choice is one current stage, never an extra reservation.
    // Cached distance is usable only while adjacency, coordinates and mode match.
    const distance = segment?.distanceKm ?? 0;
    transport.set(mode, {
      count: currentMode.count + (booked ? 0 : 1),
      distanceKm: currentMode.distanceKm + (bookedStages.get(stage) ? 0 : distance),
    });
  }
  const countryNames = [...new Set(trip.stops.map((stop) => stop.country.trim()).filter(Boolean))];
  const placeNames = [...new Set(trip.stops.map((stop) => stop.name.trim()).filter(Boolean))];
  const transportTotals = [...transport.entries()].map(([mode, values]) => ({ mode, ...values })).sort((a, b) => b.distanceKm - a.distanceKm || b.count - a.count);
  return {
    countries: new Set(countryNames.map((country) => country.toLocaleLowerCase())).size,
    countryNames,
    destinations: trip.stops.length,
    placeNames,
    nights,
    bookedNights: Math.max(0, nights - missingNights),
    missingNights,
    tripDays,
    elapsedDays,
    spent,
    remaining: trip.budget - spent,
    dailyAverage,
    projectedTotal,
    projectedDifference: trip.budget - projectedTotal,
    categoryTotals: [...totals.entries()]
      .map(([category, amount]) => ({ category, amount, percentage: spent > 0 ? (amount / spent) * 100 : 0 }))
      .sort((left, right) => right.amount - left.amount),
    transportTotals,
    recordedDistanceKm: transportTotals.reduce((sum, row) => sum + row.distanceKm, 0),
  };
}

export function calculateYearStatistics(trips: Trip[], year: number, convertExpense: (amount: number, currency: string) => number) {
  const selected = trips.filter((trip) => Number(trip.start.slice(0, 4)) === year || Number(trip.end.slice(0, 4)) === year);
  const rows = selected.map((trip) => calculateTripStatistics(trip, convertExpense));
  return {
    year,
    trips: selected.length,
    countries: new Set(rows.flatMap((row) => row.countryNames.map((name) => name.toLocaleLowerCase()))).size,
    places: new Set(rows.flatMap((row) => row.placeNames.map((name) => name.toLocaleLowerCase()))).size,
    tripDays: rows.reduce((sum, row) => sum + row.tripDays, 0),
    spent: rows.reduce((sum, row) => sum + row.spent, 0),
    recordedDistanceKm: rows.reduce((sum, row) => sum + row.recordedDistanceKm, 0),
  };
}
