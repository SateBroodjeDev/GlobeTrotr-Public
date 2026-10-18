import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTripManagementAccess } from "@/lib/trip-management-access.server";
import {
  bookingCarsRequest,
  bookingCarDestinationRequest,
  parseBookingCarDestinations,
  nearestBookingCarDestination,
  parseBookingCars,
  bookingCarErrorCode,
  bookingCarProviderErrorCode,
  bookingCarResultsErrorCode,
  type BookingCarSearchInput,
} from "@/lib/booking-cars";
import { rapidApiQuota, recordBookingProvider } from "@/lib/booking-provider-health.server";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  DATE = /^\d{4}-\d{2}-\d{2}$/,
  TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const calls = new Map<string, number[]>(),
  cache = new Map<string, { expires: number; results: ReturnType<typeof parseBookingCars> }>();
export const searchRentalCars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string } & BookingCarSearchInput) => input)
  .handler(async ({ data, context }) => {
    try {
    const coordinates = [data.pickupLat, data.pickupLon, data.dropoffLat, data.dropoffLon],
      currency = data.currency.toUpperCase(),
      driverAge = Math.trunc(data.driverAge);
    if (
      !UUID.test(data.tripId) ||
      coordinates.some((value) => !Number.isFinite(value)) ||
      Math.abs(data.pickupLat) > 90 ||
      Math.abs(data.dropoffLat) > 90 ||
      Math.abs(data.pickupLon) > 180 ||
      Math.abs(data.dropoffLon) > 180 ||
      !DATE.test(data.pickupDate) ||
      !DATE.test(data.dropoffDate) ||
      Date.parse(data.dropoffDate) < Date.parse(data.pickupDate) ||
      !TIME.test(data.pickupTime) ||
      !TIME.test(data.dropoffTime) ||
      driverAge < 20 ||
      driverAge > 65 ||
      !/^[A-Z]{3}$/.test(currency)
      || (data.pickupQuery != null && (typeof data.pickupQuery !== "string" || data.pickupQuery.trim().length > 160))
      || (data.dropoffQuery != null && (typeof data.dropoffQuery !== "string" || data.dropoffQuery.trim().length > 160))
    )
      throw new Error("INVALID_CAR_SEARCH");
    const pickupAt = Date.parse(`${data.pickupDate}T${data.pickupTime}:00Z`),
      dropoffAt = Date.parse(`${data.dropoffDate}T${data.dropoffTime}:00Z`),
      duration = (Date.parse(data.dropoffDate) - Date.parse(data.pickupDate)) / 86_400_000;
    if (dropoffAt <= pickupAt || duration > 90) throw new Error("INVALID_CAR_SEARCH");
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
    if (recent.length >= 6) throw new Error("CAR_SEARCH_RATE_LIMIT");
    recent.push(now);
    calls.set(context.userId, recent);
    const key = [
      ...coordinates.map((value) => value.toFixed(3)),
      data.pickupDate,
      data.dropoffDate,
      data.pickupTime,
      data.dropoffTime,
      driverAge,
      currency,
      data.language,
      data.pickupQuery?.trim().toLowerCase() ?? "",
      data.dropoffQuery?.trim().toLowerCase() ?? "",
    ].join(":");
    const saved = cache.get(key);
    if (saved && saved.expires > now) return { results: saved.results, cached: true };
    const apiKey = process.env.BOOKING_RAPIDAPI_KEY?.trim();
    if (!apiKey) throw new Error("BOOKING_CAR_NOT_CONFIGURED");
    const host = process.env.BOOKING_RAPIDAPI_HOST?.trim() || "booking-com18.p.rapidapi.com",
      input = { ...data, driverAge, currency };
    const headers = { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": host, Accept: "application/json" };
    async function resolveDestination(query: string | undefined, fallbackLat: number, fallbackLon: number) {
      if (!query?.trim()) return { latitude: fallbackLat, longitude: fallbackLon };
      try {
        const destinationResponse = await fetch(bookingCarDestinationRequest(query, host), { headers, signal: AbortSignal.timeout(8_000) });
        if (!destinationResponse.ok) return { latitude: fallbackLat, longitude: fallbackLon };
        const destinations = parseBookingCarDestinations(await destinationResponse.json());
        return nearestBookingCarDestination(destinations, fallbackLat, fallbackLon) ?? { latitude: fallbackLat, longitude: fallbackLon };
      } catch {
        return { latitude: fallbackLat, longitude: fallbackLon };
      }
    }
    const pickupDestinationPromise = resolveDestination(data.pickupQuery, data.pickupLat, data.pickupLon);
    const dropoffDestinationPromise = data.dropoffQuery?.trim() === data.pickupQuery?.trim()
      && data.pickupLat === data.dropoffLat && data.pickupLon === data.dropoffLon
      ? pickupDestinationPromise
      : resolveDestination(data.dropoffQuery, data.dropoffLat, data.dropoffLon);
    const [pickupDestination, dropoffDestination] = await Promise.all([
      pickupDestinationPromise,
      dropoffDestinationPromise,
    ]);
    const providerInput = {
      ...input,
      pickupLat: pickupDestination.latitude,
      pickupLon: pickupDestination.longitude,
      dropoffLat: dropoffDestination.latitude,
      dropoffLon: dropoffDestination.longitude,
    };
    let response: Response;
    try { response = await fetch(bookingCarsRequest(providerInput, host), { headers, signal: AbortSignal.timeout(20_000) }); }
    catch { recordBookingProvider("cars", { configured: true, status: "timeout", lastErrorCode: "TIMEOUT" }); throw new Error("BOOKING_CAR_TIMEOUT"); }
    const quota = rapidApiQuota(response.headers);
    if (response.status === 401 || response.status === 403) { recordBookingProvider("cars", { configured: true, status: "auth", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_CAR_AUTH"); }
    if (response.status === 429) { recordBookingProvider("cars", { configured: true, status: "quota", lastErrorCode: "HTTP_429", ...quota }); throw new Error("BOOKING_CAR_QUOTA"); }
    if (response.status === 400 || response.status === 422) { recordBookingProvider("cars", { configured: true, status: "invalid_input", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_CAR_INVALID_INPUT"); }
    if (!response.ok) { recordBookingProvider("cars", { configured: true, status: "unavailable", lastErrorCode: `HTTP_${response.status}`, ...quota }); throw new Error("BOOKING_CAR_UNAVAILABLE"); }
    const payload = await response.json();
    const providerError = bookingCarProviderErrorCode(payload);
    if (providerError) {
      const invalidInput = providerError === "BOOKING_CAR_INVALID_INPUT";
      recordBookingProvider("cars", { configured: true, status: invalidInput ? "invalid_input" : "unavailable", lastErrorCode: invalidInput ? "PROVIDER_VALIDATION" : "PROVIDER_REJECTED", ...quota });
      throw new Error(providerError);
    }
    const results = parseBookingCars(payload, providerInput);
    const resultsError = bookingCarResultsErrorCode(payload, results.length);
    if (resultsError === "BOOKING_CAR_RESPONSE_INVALID") {
      recordBookingProvider("cars", { configured: true, status: "unavailable", lastErrorCode: resultsError, ...quota });
      throw new Error(resultsError);
    }
    recordBookingProvider("cars", { configured: true, status: results.length ? "ok" : "no_results", lastSuccessAt: new Date().toISOString(), lastErrorCode: undefined, ...quota });
    if (!results.length) throw new Error("BOOKING_CAR_NO_RESULTS");
    cache.set(key, { expires: now + 10 * 60_000, results });
    return { results, cached: false };
    } catch (error) {
      // Expected failures must survive production error sanitisation. Return a
      // bounded public code, never raw provider errors, credentials or bodies.
      return { results: [], cached: false, errorCode: bookingCarErrorCode(error) };
    }
  });
