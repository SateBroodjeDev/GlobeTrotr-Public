import type { GeoResult } from "@/lib/services";

export type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  namedetails?: Record<string, unknown>;
  address?: Record<string, unknown> & { country?: string };
};

function boundedText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
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
    const lat = Number(row.lat), lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    const details = row.namedetails ?? {};
    const displayParts = boundedText(row.display_name).split(",").map((part) => part.trim()).filter(Boolean);
    const translatedName = language === "en"
      ? boundedText(details["name:en"] ?? details["official_name:en"])
      : boundedText(details["name:nl"] ?? details["official_name:nl"]);
    const address = row.address ?? {};
    // The display name carries the best discriminator for POIs and duplicate
    // place names: street, district, municipality and region. Structured
    // fields remain the fallback when Nominatim returns a short display name.
    const displayAddress = distinctAddressParts(displayParts.slice(1, -1));
    const structuredAddress = distinctAddressParts([
      boundedText(address["road"] ?? address["pedestrian"]),
      boundedText(address["house_number"]),
      boundedText(address["neighbourhood"] ?? address["suburb"] ?? address["city_district"]),
      boundedText(address["postcode"]),
      boundedText(address["city"] ?? address["town"] ?? address["village"] ?? address["hamlet"] ?? address["municipality"]),
      boundedText(address["county"]),
      boundedText(address["state"]),
    ]);
    const city = boundedText(address["city"] ?? address["town"] ?? address["village"] ?? address["hamlet"] ?? address["municipality"]);
    const addressLine = (displayAddress.length ? displayAddress : structuredAddress).join(" · ").slice(0, 240);
    return [{
      name: translatedName || boundedText(row.name) || displayParts[0] || fallbackQuery,
      country: boundedText(row.address?.country) || displayParts.at(-1) || "",
      ...(addressLine ? { addressLine } : {}),
      ...(city ? { city } : {}),
      lat,
      lon,
    }];
  });
}
