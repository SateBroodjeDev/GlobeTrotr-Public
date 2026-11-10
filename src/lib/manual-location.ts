import type { GeoResult } from "./services";
import type { Stop, Trip } from "./types.ts";
import { pruneRoutePlan, updateTripDestinationDate } from "./route-map.ts";

export type LocationDraft = { name: string; addressLine: string; city: string; country: string };
export function locationDraft(value?: Partial<GeoResult>): LocationDraft {
  return {
    name: value?.name ?? "",
    addressLine: value?.addressLine ?? "",
    city: value?.city ?? "",
    country: value?.country ?? "",
  };
}

export function locationSearchInput(draft: LocationDraft) {
  // Legacy search results store street, district and region separated by dots.
  // Reusing that entire display string as a structured street yields no match.
  const street = draft.addressLine.split("·")[0].trim();
  return street
    ? { query: "", address: { street, city: draft.city.trim(), country: draft.country.trim() } }
    : { query: [draft.name, draft.city, draft.country].map(value => value.trim()).filter(Boolean).join(", ") };
}
export function coordinateDraftPoint(coords: { lat: string; lon: string }) {
  const number = (value: string) => /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
  const point = { lat: number(coords.lat), lon: number(coords.lon) };
  return validLocationPoint(point) ? point : undefined;
}
export function validLocationPoint(
  value: { lat?: unknown; lon?: unknown } | undefined,
): value is { lat: number; lon: number } {
  return (
    !!value &&
    typeof value.lat === "number" &&
    typeof value.lon === "number" &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lon) &&
    Math.abs(value.lat) <= 90 &&
    Math.abs(value.lon) <= 180
  );
}
export function locationFieldError(draft: LocationDraft): keyof LocationDraft | undefined {
  for (const field of ["name", "addressLine", "city", "country"] as const) {
    const value = draft[field];
    if (
      typeof value !== "string" ||
      [...value].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      value.trim().length > (field === "addressLine" ? 240 : 160) ||
      ((field === "name" || field === "country") && !value.trim())
    )
      return field;
  }
  return undefined;
}
/** Preserve venue identity and exact pin when reviewing a nearby OSM address. */
export function applyAddressProposal(draft: LocationDraft, proposal: GeoResult): LocationDraft {
  return {
    ...draft,
    addressLine: proposal.addressLine || draft.addressLine,
    city: proposal.city || draft.city,
    country: proposal.country || draft.country,
  };
}
export function confirmedLocation(draft: LocationDraft, point: GeoResult): GeoResult {
  if (locationFieldError(draft) || !validLocationPoint(point)) throw new Error("LOCATION_INVALID");
  return {
    lat: point.lat,
    lon: point.lon,
    ...(point.placeType ? { placeType: point.placeType } : {}),
    name: draft.name.trim(),
    country: draft.country.trim(),
    city: draft.city.trim() || undefined,
    addressLine: draft.addressLine.trim() || undefined,
  };
}

/** One confirmed write for date and address; preserve other current visit fields. */
export function updateDestinationDetails(trip:Trip,original:Stop,date:string,location:GeoResult):Trip {
  const actual=trip.stops.find(stop=>stop.id===original.id);
  if(!actual || (["name","country","city","addressLine","lat","lon"] as const).some(key=>actual[key]!==original[key])) throw Error("DESTINATION_DATE_CONFLICT");
  const clean=confirmedLocation(locationDraft(location),location);
  const dated=updateTripDestinationDate(trip,original.id,date,original.arrive);
  return pruneRoutePlan({...dated,stops:dated.stops.map(stop=>stop.id===original.id?{...stop,...clean,city:clean.city??"",addressLine:clean.addressLine??""}:stop)});
}
