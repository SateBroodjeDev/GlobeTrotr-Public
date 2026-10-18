import { findTripHotelGaps } from "./hotel-gaps.ts";
import { isRoutePlanningItem, type Trip } from "./types.ts";

export type TripReadiness = {
  stops: number;
  tripDays: number;
  plannedDays: number;
  routeNights: number;
  missingHotelNights: number;
  packingTotal: number;
  packingDone: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDay = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

export function getTripReadiness(trip: Trip): TripReadiness {
  const start = DATE.test(trip.start) ? Date.parse(`${trip.start}T00:00:00Z`) : Number.NaN;
  const end = DATE.test(trip.end) ? Date.parse(`${trip.end}T00:00:00Z`) : Number.NaN;
  const tripDays = Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.min(367, Math.floor((end - start) / 86_400_000) + 1)
    : 0;
  const scheduled = new Set(trip.itinerary.map((item) => item.day).filter((value) => DATE.test(value)));
  for (const stop of trip.stops) {
    if (!DATE.test(stop.arrive ?? "") || !Number.isFinite(stop.nights)) continue;
    for (let offset = 0; offset <= Math.min(366, Math.max(0, Math.floor(Number(stop.nights)))); offset += 1) scheduled.add(addDay(String(stop.arrive), offset));
  }
  for (const item of trip.travelItems ?? []) {
    if (isRoutePlanningItem(item)) continue;
    if (!DATE.test(item.date)) continue;
    const endDate = DATE.test(item.endDate ?? "") && String(item.endDate) >= item.date ? String(item.endDate) : item.date;
    for (let date = item.date, guard = 0; date <= endDate && guard < 367; date = addDay(date, 1), guard += 1) scheduled.add(date);
  }
  const plannedDays = [...scheduled].filter((day) => (!trip.start || day >= trip.start) && (!trip.end || day <= trip.end)).length;
  const routeNights = Math.max(0, tripDays - 1);
  const packing = trip.packing ?? [];

  return {
    stops: trip.stops.length,
    tripDays,
    plannedDays,
    routeNights,
    missingHotelNights: findTripHotelGaps(trip).reduce((total, gap) => total + gap.nights, 0),
    packingTotal: packing.length,
    packingDone: packing.filter((item) => item.done).length,
  };
}
