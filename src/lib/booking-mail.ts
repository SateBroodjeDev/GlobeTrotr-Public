import type { TravelItem } from "./types";

export type BookingMailDraft = {
  id: string;
  subject: string;
  sender_address: string;
  booking_type: string;
  confidence: number;
  status: string;
  parsed_data: Record<string, unknown>;
  created_at?: string;
  source_expires_at?: string;
};

export const BOOKING_MAIL_FIELDS = [
  ["title", "Titel", "Title"],
  ["provider", "Aanbieder", "Provider"],
  ["bookingReference", "Boekingsnummer", "Booking reference"],
  ["flightNumber", "Vluchtnummer", "Flight number"],
  ["date", "Begindatum", "Start date"],
  ["endDate", "Einddatum", "End date"],
  ["startTime", "Begintijd", "Start time"],
  ["endTime", "Eindtijd", "End time"],
  ["departureName", "Vertrek / ophalen", "Departure / pickup"],
  ["arrivalName", "Aankomst / inleveren", "Arrival / drop-off"],
  ["locationName", "Verblijf / locatie", "Accommodation / location"],
] as const;

export function bookingMailDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = value.trim();
  const normalized = /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)
    ? raw.split(/[/-]/).reverse().join("-")
    : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : undefined;
}

export function bookingMailTravelItem(draft: BookingMailDraft, notes: string): TravelItem {
  const parsed = draft.parsed_data || {};
  if (draft.status !== "pending" || parsed.changeKind !== "new")
    throw new Error("BOOKING_MAIL_REVIEW_REQUIRED");
  if (!["flight", "lodging", "transport", "car_rental", "activity"].includes(draft.booking_type))
    throw new Error("BOOKING_MAIL_TYPE_REQUIRED");
  const date = bookingMailDate(parsed.date);
  const endDate = bookingMailDate(parsed.endDate);
  if (!date || (parsed.endDate && (!endDate || endDate < date)))
    throw new Error("BOOKING_MAIL_DATE_INVALID");
  const text = (value: unknown, max = 160) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
  const time = (value: unknown) => {
    const raw = typeof value === "string" && value.trim() ? value.trim() : undefined;
    if (raw && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw))
      throw new Error("BOOKING_MAIL_TIME_INVALID");
    return raw;
  };
  const departure = text(parsed.departureName),
    arrival = text(parsed.arrivalName),
    location = text(parsed.locationName);
  return {
    id: `mail-${draft.id}`,
    type: draft.booking_type as TravelItem["type"],
    title: text(parsed.title) || text(draft.subject) || "Booking",
    date,
    endDate,
    provider: text(parsed.provider, 80),
    bookingReference: text(parsed.bookingReference, 120),
    flightNumber: text(parsed.flightNumber, 20),
    details: {
      startTime: time(parsed.startTime),
      endTime: time(parsed.endTime),
      ...(draft.booking_type === "flight"
        ? {
            flightDepartureAirport:
              departure?.match(/(?:^|[,\s(])([A-Z]{3})\)?$/)?.[1] || departure,
            flightArrivalAirport: arrival?.match(/(?:^|[,\s(])([A-Z]{3})\)?$/)?.[1] || arrival,
          }
        : {}),
    },
    notes: [notes, departure && `From: ${departure}`, arrival && `To: ${arrival}`, location]
      .filter(Boolean)
      .join("\n"),
  };
}
