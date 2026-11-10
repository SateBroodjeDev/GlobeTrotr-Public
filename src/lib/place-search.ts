import type { GeoPlaceType, GeoResult } from "@/lib/services";

export type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  namedetails?: Record<string, unknown>;
  category?: unknown;
  class?: unknown;
  type?: unknown;
  addresstype?: unknown;
  address?: Record<string, unknown> & { country?: string };
};

export type PlaceAddressQuery = { street: string; city: string; country: string };

export function normalizePlaceQuery(value: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160
    || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw Error("PLACE_QUERY_INVALID");
  return value.trim();
}

/** Deliberate address searches must not require the user's private venue label to exist in OSM. */
export function normalizePlaceAddress(input: PlaceAddressQuery): PlaceAddressQuery {
  if (!input || typeof input !== "object" || ["street", "city", "country"].some(key => {
    const value = input[key as keyof PlaceAddressQuery];
    return typeof value !== "string" || value.trim().length > (key === "street" ? 240 : 160)
      || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  }) || !input.street.trim()) throw Error("PLACE_ADDRESS_INVALID");
  return { street: input.street.trim(), city: input.city.trim(), country: input.country.trim() };
}

function boundedText(value: unknown) {
  return typeof value === "string" ? [...value].filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join("").trim().slice(0, 160) : "";
}

/** Use structured provider fields, never infer a venue type from its name. */
function resultType(row: NominatimPlace): GeoPlaceType | undefined {
  const category = boundedText(row.category || row.class).toLowerCase();
  const type = boundedText(row.type).toLowerCase();
  const addressType = boundedText(row.addresstype).toLowerCase();
  if (category === "aeroway" && ["aerodrome", "terminal"].includes(type)) return "airport";
  if (category === "railway" && ["station", "halt", "subway_entrance"].includes(type)) return "train_station";
  if ((category === "highway" && type === "bus_stop") || (category === "amenity" && type === "bus_station")) return "bus_stop";
  if (category === "amenity" && type === "ferry_terminal") return "ferry_terminal";
  if (["house", "house_number", "building"].includes(addressType)) return "address";
  if (category === "highway" && ["residential", "pedestrian", "primary", "secondary", "tertiary", "unclassified", "living_street", "service", "footway", "path", "track", "road"].includes(type)) return "street";
  if (category === "tourism" && ["hotel", "hostel", "motel", "guest_house", "apartment", "camp_site"].includes(type)) return "accommodation";
  if (category === "tourism" && ["attraction", "museum", "viewpoint"].includes(type)) return "attraction";
  if (["place", "boundary"].includes(category)) {
    const settlement = addressType || type;
    if (["city", "town", "village", "country"].includes(settlement)) return settlement as GeoPlaceType;
  }
  return undefined;
}

function distinctAddressParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeNominatimPlaces(rows: NominatimPlace[], language: "nl" | "en", fallbackQuery: string): GeoResult[] {
  return rows.flatMap((row): GeoResult[] => {
    if (!row || typeof row !== "object" || typeof row.lat !== "string" || typeof row.lon !== "string" || !row.lat.trim() || !row.lon.trim()) return [];
    const lat = Number(row.lat), lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    const details = row.namedetails ?? {};
    const displayParts = (typeof row.display_name === "string" ? row.display_name.slice(0, 2048) : "").split(",").map(boundedText).filter(Boolean);
    const translatedName = language === "en"
      ? boundedText(details["name:en"] ?? details["official_name:en"])
      : boundedText(details["name:nl"] ?? details["official_name:nl"]);
    const address = row.address ?? {};
    // The display name carries the best discriminator for POIs and duplicate
    // place names: street, district, municipality and region. Structured
    // fields remain the fallback when Nominatim returns a short display name.
    const displayAddress = distinctAddressParts(displayParts.slice(1, -1));
    const road = boundedText(address["road"] ?? address["pedestrian"]);
    const houseNumber = boundedText(address["house_number"]);
    const structuredAddress = distinctAddressParts([
      [road, houseNumber].filter(Boolean).join(" "),
      boundedText(address["neighbourhood"] ?? address["suburb"] ?? address["city_district"]),
      boundedText(address["postcode"]),
      boundedText(address["city"] ?? address["town"] ?? address["village"] ?? address["hamlet"] ?? address["municipality"]),
      boundedText(address["county"]),
      boundedText(address["state"]),
    ]);
    const city = boundedText(address["city"] ?? address["town"] ?? address["village"] ?? address["hamlet"] ?? address["municipality"]);
    // A reverse response can start display_name with the house number. Slicing
    // off its first component would silently remove that number from the address.
    const addressLine = (road && houseNumber ? structuredAddress : road
      ? distinctAddressParts([road, ...(displayAddress.length ? displayAddress : structuredAddress)])
      : displayAddress.length ? displayAddress : structuredAddress).join(" · ").slice(0, 240);
    const placeType = resultType(row);
    return [{
      name: translatedName || boundedText(row.name) || (road && houseNumber ? `${road} ${houseNumber}`.slice(0,160) : displayParts[0]) || fallbackQuery,
      country: boundedText(row.address?.country) || displayParts.at(-1) || "",
      ...(addressLine ? { addressLine } : {}),
      ...(city ? { city } : {}),
      ...(placeType ? { placeType } : {}),
      lat,
      lon,
    }];
  });
}
