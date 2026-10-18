import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeoResult } from "@/lib/services";
import { normalizeNominatimPlaces, type NominatimPlace } from "@/lib/place-search";
import { fetchNominatimPlaces } from "@/lib/place-search-client.server";

export const searchPlacesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { query: string; language?: "nl" | "en" }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim();
    if (query.length < 2 || query.length > 160) return [] as GeoResult[];
    const language = data.language === "en" ? "en" : "nl";
    const rows: NominatimPlace[] = await fetchNominatimPlaces(query, language);
    return normalizeNominatimPlaces(rows, language, query);
  });
