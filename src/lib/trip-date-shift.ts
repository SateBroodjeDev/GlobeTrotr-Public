import { isRoutePlanningItem, type Trip } from "./types.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string) {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function daysBetween(from: string, to: string) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) throw new Error("INVALID_TRIP_DATE");
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function shiftIsoDate(value: string, days: number) {
  const date = parseDate(value);
  if (!date || !Number.isInteger(days)) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type TripDateShiftPreview = {
  days: number;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  stops: number;
  itineraryItems: number;
  bookings: number;
  candidates: number;
};

export function previewTripDateShift(trip: Trip, newStart: string): TripDateShiftPreview {
  const days = daysBetween(trip.start, newStart);
  return {
    days,
    oldStart: trip.start,
    oldEnd: trip.end,
    newStart,
    newEnd: shiftIsoDate(trip.end, days),
    stops: trip.stops.filter((stop) => Boolean(stop.arrive && parseDate(stop.arrive))).length,
    itineraryItems: trip.itinerary.filter((item) => Boolean(parseDate(item.day))).length,
    bookings: (trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item) && Boolean(parseDate(item.date))).length,
    candidates: (trip.travelOptions ?? []).filter((item) => Boolean(parseDate(item.startDate))).length,
  };
}

/**
 * Moves planning dates by a fixed number of UTC calendar days. Historical
 * expenses and metadata such as createdAt/checkedAt deliberately stay intact.
 */
export function shiftTripDates(trip: Trip, newStart: string): Trip {
  const preview = previewTripDateShift(trip, newStart);
  const shift = (value: string | undefined) => value ? shiftIsoDate(value, preview.days) : value;
  return {
    ...trip,
    start: preview.newStart,
    end: preview.newEnd,
    stops: trip.stops.map((stop) => ({ ...stop, arrive: shift(stop.arrive) })),
    itinerary: trip.itinerary.map((item) => ({ ...item, day: shiftIsoDate(item.day, preview.days) })),
    travelItems: trip.travelItems?.map((item) => ({
      ...item,
      date: shiftIsoDate(item.date, preview.days),
      endDate: shift(item.endDate),
    })),
    travelOptions: trip.travelOptions?.map((option) => ({
      ...option,
      startDate: shiftIsoDate(option.startDate, preview.days),
      endDate: shift(option.endDate),
    })),
  };
}
