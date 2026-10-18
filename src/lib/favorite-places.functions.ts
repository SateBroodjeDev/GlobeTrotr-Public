import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FavoritePlace = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
};

const UUID = /^[0-9a-f-]{36}$/i;
const clean = (value: string, maximum: number) => value.trim().slice(0, maximum);

export const getFavoritePlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("favorite_places")
      .select("id,name,country,lat,lon")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("FAVORITE_PLACES_UNAVAILABLE");
    return (data ?? []).map((place: any) => ({
      id: place.id,
      name: place.name,
      country: place.country,
      lat: Number(place.lat),
      lon: Number(place.lon),
    })) as FavoritePlace[];
  });

export const saveFavoritePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Omit<FavoritePlace, "id">) => input)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const name = clean(data.name, 120);
    const country = clean(data.country, 100);
    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (
      !name ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180
    )
      throw new Error("INVALID_FAVORITE_PLACE");
    const { data: saved, error } = await db
      .from("favorite_places")
      .upsert(
        { user_id: context.userId, name, country, lat, lon },
        { onConflict: "user_id,name,lat,lon" },
      )
      .select("id")
      .single();
    if (error || !saved) throw new Error("FAVORITE_PLACE_SAVE_FAILED");
    return { id: saved.id as string };
  });

export const removeFavoritePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.id)) throw new Error("INVALID_FAVORITE_PLACE");
    const db = context.supabase as any;
    const { error } = await db
      .from("favorite_places")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("FAVORITE_PLACE_DELETE_FAILED");
    return { ok: true };
  });
