import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeNominatimPlaces, normalizePlaceAddress, normalizePlaceQuery, type NominatimPlace, type PlaceAddressQuery } from "@/lib/place-search";
import { fetchNominatimPlaces, fetchNominatimAddress } from "@/lib/place-search-client.server";
import { validLocationPoint } from "@/lib/manual-location";

export const searchPlacesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string; language?: "nl" | "en"; address?: PlaceAddressQuery }) => {
    if (typeof input?.query !== "string") throw Error("PLACE_QUERY_INVALID");
    return { query: input.address ? "" : normalizePlaceQuery(input.query), language: input.language, ...(input.address ? { address: normalizePlaceAddress(input.address) } : {}) };
  })
  .handler(async ({ data }) => {
    const query = data.query.trim();
    const language = data.language === "en" ? "en" : "nl";
    const rows: NominatimPlace[] = await fetchNominatimPlaces(query, language, data.address);
    const results = normalizeNominatimPlaces(rows, language, query);
    if (rows.length && !results.length) throw Error("PLACE_SEARCH_RESPONSE_INVALID");
    return results;
  });

export const reversePlaceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { lat: number; lon: number; language?: "nl" | "en" }) => {
    if (!validLocationPoint(input)) throw new Error("PLACE_POINT_INVALID");
    return input;
  })
  .handler(async ({ data }) => {
    const language = data.language === "en" ? "en" : "nl";
    const rows = await fetchNominatimAddress(data.lat, data.lon, language);
    return normalizeNominatimPlaces(rows, language, "")[0] ?? null;
  });
