import { isRoutePlanningItem, type ItineraryItem, type TravelItem, type Trip } from "./types.ts";
import { findTripHotelGaps } from "./hotel-gaps.ts";

const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export type TimelineEntry = {
  id: string;
  day: string;
  title: string;
  subtitle?: string;
  kind: "manual" | TravelItem["type"];
  time?: string;
  item?: TravelItem;
  manual?: ItineraryItem;
  phase?: "start" | "ongoing" | "end";
};

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  const out: string[] = [];
  if (!validDay(start) || !validDay(end)) return out;
  for (let current = start; current <= end && out.length < 370; current = addDays(current, 1)) {
    out.push(current);
  }
  return out;
}

function bookingEntries(
  item: TravelItem,
  text: (nl: string, en: string) => string,
): TimelineEntry[] {
  if (!validDay(item.date)) return [];
  const end = item.endDate && validDay(item.endDate) && item.endDate >= item.date ? item.endDate : item.date;
  const multiDay = (item.type === "lodging" || item.type === "car_rental") && end > item.date;
  if (!multiDay) {
    const entries: TimelineEntry[] = [
      {
        id: item.id,
        day: item.date,
        title: item.title,
        kind: item.type,
        item,
        time: bookingStartTime(item),
      },
    ];
    const arrival = arrivalDay(item);
    if ((item.type === "flight" || item.type === "transport") && arrival > item.date) entries.push({
      id: `${item.id}:arrival`, day: arrival, title: `${text("Aankomst", "Arrival")} · ${item.title}`,
      kind: item.type, item, phase: "end", time: item.details?.endTime || item.details?.flightArrivalScheduled?.slice(11, 16),
    });
    return entries;
  }
  const dates = daysBetween(item.date, end);
  return dates.map((day, index) => {
    const isStart = index === 0;
    const isEnd = index === dates.length - 1;
    const lodging = item.type === "lodging";
    return {
      id: `${item.id}:${day}`,
      day,
      kind: item.type,
      item,
      phase: isStart ? "start" : isEnd ? "end" : "ongoing",
      title: isStart
        ? `${lodging ? text("Inchecken", "Check in") : text("Huurauto ophalen", "Collect rental car")} · ${item.title}`
        : isEnd
          ? `${lodging ? text("Uitchecken", "Check out") : text("Huurauto inleveren", "Return rental car")} · ${item.title}`
          : `${lodging ? text("Overnachting", "Overnight stay") : text("Huurauto beschikbaar", "Rental car available")} · ${item.title}`,
      subtitle:
        isStart || isEnd
          ? undefined
          : text(`Dag ${index + 1} van ${dates.length}`, `Day ${index + 1} of ${dates.length}`),
      time: isStart ? item.details?.startTime : isEnd ? item.details?.endTime : undefined,
    };
  });
}

const bookingStartTime = (item: TravelItem) => item.details?.startTime || item.details?.flightDepartureScheduled?.slice(11, 16);
const arrivalDay = (item: TravelItem) => {
  const day = item.endDate || item.details?.flightArrivalScheduled?.slice(0, 10) || item.date;
  return validDay(day) ? day : item.date;
};


export function buildTripTimelineEntries(trip: Trip, text: (nl: string, en: string) => string): TimelineEntry[] {
    const bookedItems = (trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item));
    const bookingIds = new Set(bookedItems.map((item) => item.id));
    const manual = trip.itinerary
      .filter((item) => !item.sourceTravelItemId || !bookingIds.has(item.sourceTravelItemId))
      // Older booking rows had no reference. They can be identified safely by exact date and title.
      .filter(
        (item) =>
          !bookedItems.some(
            (booking) => booking.date === item.day && booking.title === item.title,
          ),
      )
      .map<TimelineEntry>((item) => ({
        id: item.id,
        day: item.day,
        title: item.title,
        subtitle: item.notes,
        kind: "manual",
        manual: item,
      }));
    return [
      ...manual.filter(entry => validDay(entry.day)),
      ...bookedItems.flatMap((item) => bookingEntries(item, text)),
    ].sort((a, b) => {
      const byDay = a.day.localeCompare(b.day);
      return byDay || (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
    });
}

export function tripTimelineDays(trip: Trip, entries: TimelineEntry[]) {
  return [...new Set([...daysBetween(trip.start, trip.end), ...entries.map(entry => entry.day).filter(validDay)])].sort();
}

export function tripDayOverview(trip: Trip, day: string) {
  const bookings = (trip.travelItems ?? []).filter(item => !isRoutePlanningItem(item));
  const stays = bookings.filter(item => item.type === "lodging" && item.date <= day && day < (item.endDate && item.endDate > item.date ? item.endDate : validDay(item.date) ? addDays(item.date, 1) : item.date));
  const starts = bookings.filter(item => item.date === day);
  const missingNight = findTripHotelGaps(trip).some(gap => gap.startDate <= day && day < gap.endDate);
  return {
    stays,
    movements: bookings.filter(item => (item.type === "flight" || item.type === "transport") && (item.date === day || arrivalDay(item) === day)),
    activities: starts.filter(item => item.type === "activity"),
    missingNight,
    missingTimes: starts.filter(item => item.type !== "lodging" && !bookingStartTime(item)),
    missingLocations: starts.filter(item => (item.type === "flight" || item.type === "transport") && (!item.departure || !item.arrival)),
  };
}
