import { isRoutePlanningItem, type Stop, type TravelItem, type TravelLocation, type Trip } from "./types.ts";

export type HotelGap = {
  id: string;
  stopId: string;
  stopName: string;
  country: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  nights: number;
};

export type TripHotelGap = {
  id: string;
  startDate: string;
  endDate: string;
  nights: number;
  suggestedStopId?: string;
  suggestedLocation?: TravelLocation;
  confidence: "overnight" | "booking" | "route" | "unknown";
};

const CONFIDENCE_RANK: Record<TripHotelGap["confidence"], number> = {
  unknown: 0,
  route: 1,
  booking: 2,
  overnight: 3,
};

export function configuredRouteNights(stops: Stop[]) {
  return stops.reduce(
    (total, stop) =>
      total +
      (DATE.test(stop.arrive ?? "") && Number.isFinite(stop.nights) && Number(stop.nights) > 0
        ? Math.min(366, Math.floor(Number(stop.nights)))
        : 0),
    0,
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

/** Search a chosen part of an uncovered period, without covering its other nights. */
export function hotelGapSearchPeriod(gap: Pick<TripHotelGap, "startDate" | "endDate" | "nights">, nights: number) {
  const start = new Date(`${gap.startDate}T00:00:00Z`);
  const end = new Date(`${gap.endDate}T00:00:00Z`);
  if (!Number.isInteger(nights) || nights < 1 || nights > Math.min(60, gap.nights)
    || !Number.isInteger(gap.nights) || gap.nights < 1
    || !DATE.test(gap.startDate) || !DATE.test(gap.endDate) || !Number.isFinite(start.getTime())
    || !Number.isFinite(end.getTime()) || start.toISOString().slice(0, 10) !== gap.startDate
    || end.toISOString().slice(0, 10) !== gap.endDate) throw new Error("INVALID_HOTEL_PERIOD");
  const endDate = day(gap.startDate, nights);
  if (endDate > gap.endDate) throw new Error("INVALID_HOTEL_PERIOD");
  return { startDate: gap.startDate, endDate, nights };
}

/** Finds route nights that are not covered by a booked lodging item. */
export function findHotelGaps(stops: Stop[], travelItems: TravelItem[] = []): HotelGap[] {
  const covered = new Set<string>();
  for (const item of travelItems) {
    if (item.type !== "lodging" || !DATE.test(item.date)) continue;
    const end =
      DATE.test(item.endDate ?? "") && String(item.endDate) > item.date
        ? String(item.endDate)
        : day(item.date, 1);
    for (
      let date = item.date, guard = 0;
      date < end && guard < 366;
      date = day(date, 1), guard += 1
    ) {
      covered.add(date);
    }
  }

  const gaps: HotelGap[] = [];
  for (const stop of stops) {
    if (!DATE.test(stop.arrive ?? "") || !Number.isFinite(stop.nights) || Number(stop.nights) < 1)
      continue;
    let openStart: string | undefined;
    const nights = Math.min(366, Math.floor(Number(stop.nights)));
    for (let offset = 0; offset <= nights; offset += 1) {
      const date = day(String(stop.arrive), offset);
      const missing = offset < nights && !covered.has(date);
      if (missing && !openStart) openStart = date;
      if (!missing && openStart) {
        const count = Math.round(
          (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${openStart}T00:00:00Z`)) / 86_400_000,
        );
        gaps.push({
          id: `${stop.id}:${openStart}`,
          stopId: stop.id,
          stopName: stop.name,
          country: stop.country,
          lat: stop.lat,
          lon: stop.lon,
          startDate: openStart,
          endDate: date,
          nights: count,
        });
        openStart = undefined;
      }
    }
  }
  return gaps;
}

/** Finds every uncovered night in the trip period and suggests the most likely route stop. */
export function findTripHotelGaps(
  trip: Pick<Trip, "start" | "end" | "stops" | "travelItems">,
): TripHotelGap[] {
  if (!DATE.test(trip.start) || !DATE.test(trip.end) || trip.end <= trip.start) return [];
  const covered = new Set<string>();
  for (const item of trip.travelItems ?? []) {
    if (item.type !== "lodging" || !DATE.test(item.date)) continue;
    const end =
      DATE.test(item.endDate ?? "") && String(item.endDate) > item.date
        ? String(item.endDate)
        : day(item.date, 1);
    for (
      let date = item.date, guard = 0;
      date < end && guard < 366;
      date = day(date, 1), guard += 1
    )
      covered.add(date);
  }

  const datedStops = [...trip.stops]
    .filter((stop) => DATE.test(stop.arrive ?? ""))
    .sort((a, b) => String(a.arrive).localeCompare(String(b.arrive)));
  const datedLocations = (trip.travelItems ?? [])
    // An activity describes something visited during the day, not where the
    // traveller sleeps. Only movements may advance the inferred night stop.
    .filter(
      (item) => !isRoutePlanningItem(item) && ["flight", "transport", "car_rental"].includes(item.type) && DATE.test(item.date),
    )
    .flatMap((item) => {
      const location = item.arrival ?? (item.type === "car_rental" ? item.location : undefined);
      return location ? [{ date: item.date, location }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const missing: Array<{
    date: string;
    stopId?: string;
    location?: TravelLocation;
    confidence: TripHotelGap["confidence"];
  }> = [];
  for (
    let date = trip.start, guard = 0;
    date < trip.end && guard < 366;
    date = day(date, 1), guard += 1
  ) {
    if (covered.has(date)) continue;
    const overnight = datedStops.find((stop) => {
      const nights = Math.max(0, Math.floor(Number(stop.nights) || 0));
      return nights > 0 && String(stop.arrive) <= date && date < day(String(stop.arrive), nights);
    });
    const latestLocation = [...datedLocations]
      .reverse()
      .find((item) => item.date <= date)?.location;
    const latest = [...datedStops].reverse().find((stop) => String(stop.arrive) <= date);
    missing.push(
      overnight
        ? { date, stopId: overnight.id, confidence: "overnight" }
        : latestLocation
          ? { date, location: latestLocation, confidence: "booking" }
          : { date, stopId: latest?.id, confidence: latest ? "route" : "unknown" },
    );
  }

  const groups: TripHotelGap[] = [];
  for (const night of missing) {
    const previous = groups.at(-1);
    const locationKey = night.location
      ? `${night.location.name}:${night.location.lat}:${night.location.lon}`
      : "";
    const previousLocationKey = previous?.suggestedLocation
      ? `${previous.suggestedLocation.name}:${previous.suggestedLocation.lat}:${previous.suggestedLocation.lon}`
      : "";
    if (
      previous &&
      previous.endDate === night.date &&
      previous.suggestedStopId === night.stopId &&
      previousLocationKey === locationKey
    ) {
      previous.endDate = day(night.date, 1);
      previous.nights += 1;
      if (CONFIDENCE_RANK[night.confidence] > CONFIDENCE_RANK[previous.confidence]) {
        previous.confidence = night.confidence;
      }
    } else {
      groups.push({
        id: `${night.date}:${night.stopId ?? (locationKey || "unknown")}`,
        startDate: night.date,
        endDate: day(night.date, 1),
        nights: 1,
        ...(night.stopId ? { suggestedStopId: night.stopId } : {}),
        ...(night.location ? { suggestedLocation: night.location } : {}),
        confidence: night.confidence,
      });
    }
  }
  return groups;
}

export function createHotelGapBooking(input: {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: TravelLocation;
  provider?: string;
  bookingReference?: string;
  sourceUrl?: string;
  amount?: number;
  currency?: string;
  note: string;
}): TravelItem {
  if (
    !DATE.test(input.startDate) ||
    !DATE.test(input.endDate) ||
    input.endDate <= input.startDate
  ) {
    throw new Error("INVALID_HOTEL_PERIOD");
  }
  const sourceUrl = input.sourceUrl?.trim().slice(0, 2048);
  return {
    id: input.id,
    type: "lodging",
    title: input.name.trim().slice(0, 160),
    date: input.startDate,
    endDate: input.endDate,
    provider: input.provider?.trim().slice(0, 120) || undefined,
    bookingReference: input.bookingReference?.trim().slice(0, 160) || undefined,
    location: input.location,
    amount:
      Number.isFinite(input.amount) && Number(input.amount) >= 0 ? Number(input.amount) : undefined,
    currency: /^[A-Z]{3}$/.test(input.currency ?? "") ? input.currency : undefined,
    notes: [input.note.trim(), sourceUrl && `Source: ${sourceUrl}`].filter(Boolean).join("\n"),
  };
}
