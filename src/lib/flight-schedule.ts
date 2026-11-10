export type ScheduleFlight = {
  Time?: string;
  Date?: string;
  IATA?: string;
  Flight?: string;
  Airline?: string;
  Status?: string;
  Destination?: string;
};

export type ScheduleResponse = { flights?: ScheduleFlight[] };

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value)
    return undefined;
  return parsed;
}

export function isScheduleDateSupported(flightDate: string, now = new Date()): boolean {
  const requested = isoDay(flightDate);
  if (requested === undefined) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const difference = Math.round((requested - today) / DAY_MS);
  return difference >= -5 && difference <= 1;
}

export function formatScheduleDate(flightDate: string): string | undefined {
  if (isoDay(flightDate) === undefined) return undefined;
  const [year, month, day] = flightDate.split("-");
  return `${day}-${month}-${year}`;
}

const normalizedFlightNumber = (value?: string) => value?.toUpperCase().replace(/\s+/g, "") ?? "";

export function findScheduledFlight(payload: ScheduleResponse, flightNumber: string) {
  const expected = normalizedFlightNumber(flightNumber);
  return payload.flights?.find((flight) => normalizedFlightNumber(flight.Flight) === expected);
}
