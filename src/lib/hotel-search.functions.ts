import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTripManagementAccess } from "@/lib/trip-management-access.server";
import {
  bookingHotelsRequest,
  parseBookingHotels,
  type BookingHotelSearchInput,
} from "@/lib/booking-hotels";
import { rapidApiQuota, recordBookingProvider } from "@/lib/booking-provider-health.server";
import { overpassElements, overpassEndpoints } from "@/lib/nearby-places";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  RADIUS = 15_000;
const cache = new Map<
    string,
    { expires: number; results: HotelSearchResult[]; provider: "booking" | "openstreetmap"; bookingUnavailable: boolean; bookingStatus: "ok" | "no_results" | "timeout" | "unavailable" }
  >(),
  calls = new Map<string, number[]>();
export type HotelSearchResult = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
  distanceKm: number;
  website?: string;
  osmUrl: string;
  stars?: string;
  provider: "booking" | "openstreetmap";
  amount?: number;
  currency?: string;
  taxesAndFees?: number;
  reviewScore?: number;
  reviewCount?: number;
  photoUrl?: string;
};
function safeUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
function distanceKm(a: number, b: number, c: number, d: number) {
  const r = 6371,
    toRad = (x: number) => (x * Math.PI) / 180,
    p1 = toRad(a),
    p2 = toRad(c),
    dp = toRad(c - a),
    dl = toRad(d - b),
    q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

async function bookingSearch(
  input: BookingHotelSearchInput,
): Promise<HotelSearchResult[] | undefined> {
  const apiKey = process.env.BOOKING_RAPIDAPI_KEY?.trim();
  if (!apiKey) return undefined;
  const host = process.env.BOOKING_RAPIDAPI_HOST?.trim() || "booking-com18.p.rapidapi.com";
  let response: Response;
  try { response = await fetch(bookingHotelsRequest(input, host), { headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": host, Accept: "application/json" }, signal: AbortSignal.timeout(12_000) }); }
  catch { recordBookingProvider("hotels", { configured: true, status: "timeout", lastErrorCode: "TIMEOUT" }); throw new Error("BOOKING_HOTEL_TIMEOUT"); }
  const quota = rapidApiQuota(response.headers);
  if (response.status === 401 || response.status === 403) { recordBookingProvider("hotels", { configured: true, status: "auth", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_HOTEL_AUTH"); }
  if (response.status === 429) { recordBookingProvider("hotels", { configured: true, status: "quota", lastErrorCode: "HTTP_429", ...quota }); throw new Error("BOOKING_HOTEL_QUOTA"); }
  if (response.status === 400 || response.status === 422) { recordBookingProvider("hotels", { configured: true, status: "invalid_input", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_HOTEL_INVALID_INPUT"); }
  if (!response.ok) { recordBookingProvider("hotels", { configured: true, status: "unavailable", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_HOTEL_UNAVAILABLE"); }
  const payload = await response.json();
  if (payload?.status === false) {
    console.error("[Booking hotels] Provider rejected search", { code: "PROVIDER_STATUS_FALSE" });
    recordBookingProvider("hotels", { configured: true, status: "unavailable", lastErrorCode: "PROVIDER_REJECTED", ...quota }); throw new Error("BOOKING_HOTEL_UNAVAILABLE");
  }
  const parsed = parseBookingHotels(payload, input);
  recordBookingProvider("hotels", { configured: true, status: parsed.length ? "ok" : "no_results", lastSuccessAt: new Date().toISOString(), lastErrorCode: undefined, ...quota });
  return parsed.map((hotel) => ({
    ...hotel,
    provider: "booking" as const,
    distanceKm: Number(distanceKm(input.lat, input.lon, hotel.lat, hotel.lon).toFixed(1)),
    website: hotel.sourceUrl,
    osmUrl: hotel.sourceUrl,
  }));
}

async function openStreetMapSearch(lat: number, lon: number): Promise<HotelSearchResult[]> {
  const endpoints = overpassEndpoints(process.env.OVERPASS_API_URLS ?? process.env.OVERPASS_API_URL);
  const query = `[out:json][timeout:9][maxsize:3145728];nwr["tourism"~"^(hotel|hostel|guest_house|motel|apartment|chalet)$"](around:${RADIUS},${lat},${lon});out center tags 50;`;
  const controller = new AbortController();
  const attempts = endpoints.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "GlobeTrotr/1.1 (https://globetrotr.nl/contact)",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok) throw new Error();
    const elements = overpassElements(await response.json());
    if (!elements) throw new Error("OVERPASS_RESPONSE_INVALID");
    return { elements };
  });
  let payload: { elements?: any[] };
  try {
    payload = await Promise.any(attempts);
  } catch {
    throw new Error("HOTEL_SEARCH_UNAVAILABLE");
  } finally {
    controller.abort();
  }
  return (payload.elements ?? [])
    .map((element) => {
      const itemLat = Number(element.lat ?? element.center?.lat),
        itemLon = Number(element.lon ?? element.center?.lon),
        tags = element.tags ?? {},
        url = `https://www.openstreetmap.org/${element.type}/${element.id}`;
      return {
        id: `${element.type}/${element.id}`,
        name: String(tags.name ?? "")
          .trim()
          .slice(0, 160),
        kind: String(tags.tourism ?? "hotel").slice(0, 40),
        lat: itemLat,
        lon: itemLon,
        distanceKm: Number(distanceKm(lat, lon, itemLat, itemLon).toFixed(1)),
        website: safeUrl(tags["contact:website"] ?? tags.website),
        osmUrl: url,
        stars: tags.stars ? String(tags.stars).slice(0, 10) : undefined,
        provider: "openstreetmap" as const,
      };
    })
    .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);
}

export const searchNearbyHotels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      tripId: string;
      lat: number;
      lon: number;
      arrivalDate: string;
      departureDate: string;
      adults?: number;
      rooms?: number;
      currency?: string;
      language?: "nl" | "en";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const adults = Math.trunc(data.adults ?? 2),
      rooms = Math.trunc(data.rooms ?? 1),
      currency = (data.currency ?? "EUR").toUpperCase();
    if (
      !UUID.test(data.tripId) ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lon) ||
      Math.abs(data.lat) > 90 ||
      Math.abs(data.lon) > 180 ||
      !validDate(data.arrivalDate) ||
      !validDate(data.departureDate) ||
      Date.parse(data.departureDate) <= Date.parse(data.arrivalDate) ||
      adults < 1 ||
      adults > 20 ||
      rooms < 1 ||
      rooms > 10 ||
      !/^[A-Z]{3}$/.test(currency) ||
      (Date.parse(data.departureDate) - Date.parse(data.arrivalDate)) / 86_400_000 > 60
    )
      throw new Error("INVALID_HOTEL_SEARCH");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server"),
      db = supabaseAdmin as any;
    const { data: trip } = await db
      .from("trips")
      .select("workspace_user_id")
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    if (trip.workspace_user_id !== context.userId) {
      const { data: member } = await db
        .from("trip_members")
        .select("id")
        .eq("trip_uuid", data.tripId)
        .eq("user_id", context.userId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) await requireTripManagementAccess(db, context.userId, data.tripId, "trips_view");
    }
    const now = Date.now(),
      recent = (calls.get(context.userId) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= 8) throw new Error("HOTEL_SEARCH_RATE_LIMIT");
    recent.push(now);
    calls.set(context.userId, recent);
    const key = [
      data.lat.toFixed(3),
      data.lon.toFixed(3),
      data.arrivalDate,
      data.departureDate,
      adults,
      rooms,
      currency,
      data.language ?? "nl",
      Boolean(process.env.BOOKING_RAPIDAPI_KEY),
    ].join(":");
    const cached = cache.get(key);
    if (cached && cached.expires > now)
      return { results: cached.results, cached: true, provider: cached.provider, bookingUnavailable: cached.bookingUnavailable, bookingStatus: cached.bookingStatus };
    let results: HotelSearchResult[] | undefined,
      provider: "booking" | "openstreetmap" = "booking",
      bookingUnavailable = false,
      bookingStatus: "ok" | "no_results" | "timeout" | "unavailable" = "ok";
    try {
      results = await bookingSearch({
        lat: data.lat,
        lon: data.lon,
        arrivalDate: data.arrivalDate,
        departureDate: data.departureDate,
        adults,
        rooms,
        currency,
        language: data.language ?? "nl",
      });
    } catch (error) {
      if (error instanceof Error && ["BOOKING_HOTEL_AUTH", "BOOKING_HOTEL_QUOTA", "BOOKING_HOTEL_INVALID_INPUT"].includes(error.message)) throw error;
      bookingUnavailable = true;
      bookingStatus = error instanceof Error && error.message === "BOOKING_HOTEL_TIMEOUT" ? "timeout" : "unavailable";
    }
    if (!results?.length) {
      if (!bookingUnavailable) bookingStatus = "no_results";
      provider = "openstreetmap";
      results = await openStreetMapSearch(data.lat, data.lon);
    }
    cache.set(key, { expires: now + 10 * 60_000, results, provider, bookingUnavailable, bookingStatus });
    return { results, cached: false, provider, bookingUnavailable, bookingStatus };
  });
