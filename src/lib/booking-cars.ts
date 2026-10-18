const BOOKING_HOST = "booking-com18.p.rapidapi.com";
export function bookingCarErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "BOOKING_RAPIDAPI_HOST_INVALID") return "BOOKING_CAR_NOT_CONFIGURED";
  return [
    "INVALID_CAR_SEARCH", "CAR_SEARCH_RATE_LIMIT", "BOOKING_CAR_NOT_CONFIGURED",
    "BOOKING_CAR_QUOTA", "BOOKING_CAR_AUTH", "BOOKING_CAR_NO_RESULTS",
    "BOOKING_CAR_INVALID_INPUT", "BOOKING_CAR_TIMEOUT", "BOOKING_CAR_UNAVAILABLE", "BOOKING_CAR_RESPONSE_INVALID",
  ].includes(message) ? message : "BOOKING_CAR_UNAVAILABLE";
}

export type BookingCarSearchInput = {
  pickupQuery?: string;
  dropoffQuery?: string;
  pickupLat: number;
  pickupLon: number;
  dropoffLat: number;
  dropoffLon: number;
  pickupDate: string;
  dropoffDate: string;
  pickupTime: string;
  dropoffTime: string;
  driverAge: number;
  currency: string;
  language: "nl" | "en";
};
export type BookingCarDestination = { name: string; latitude: number; longitude: number };
export type BookingCar = {
  id: string;
  name: string;
  supplier?: string;
  category?: string;
  transmission?: string;
  amount?: number;
  currency?: string;
  deposit?: number;
  seats?: number;
  baggage?: number;
  freeCancellation?: boolean;
  pickupName?: string;
  dropoffName?: string;
  imageUrl?: string;
  sourceUrl: string;
};
function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function number(value: unknown) {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined;
}
function https(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
export function bookingCarsRequest(input: BookingCarSearchInput, host = BOOKING_HOST) {
  if (host !== BOOKING_HOST) throw new Error("BOOKING_RAPIDAPI_HOST_INVALID");
  const url = new URL(`https://${host}/car/search-coordinates`);
  const params = {
    pickUpCoord: `${input.pickupLat},${input.pickupLon}`,
    dropOffCoord: `${input.dropoffLat},${input.dropoffLon}`,
    pickUpDate: input.pickupDate,
    dropOffDate: input.dropoffDate,
    pickUpTime: input.pickupTime,
    dropOffTime: input.dropoffTime,
    driverAge: String(input.driverAge),
    currencyCode: input.currency,
    languageCode: input.language === "nl" ? "nl" : "en-gb",
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}
export function bookingCarProviderErrorCode(payload: unknown): string | undefined {
  const root = object(payload);
  if (root.status !== false) return undefined;
  return Object.keys(object(root.errors)).length
    ? "BOOKING_CAR_INVALID_INPUT" : "BOOKING_CAR_UNAVAILABLE";
}
export function bookingCarDestinationRequest(query: string, host = BOOKING_HOST) {
  if (host !== BOOKING_HOST) throw new Error("BOOKING_RAPIDAPI_HOST_INVALID");
  const normalized = query.trim().slice(0, 160);
  if (normalized.length < 2) throw new Error("BOOKING_CAR_DESTINATION_INVALID");
  const url = new URL(`https://${host}/car/auto-complete`);
  url.searchParams.set("query", normalized);
  return url;
}
export function parseBookingCarDestinations(payload: unknown): BookingCarDestination[] {
  const root = object(payload);
  const data = object(root.data);
  const rows = [root.data, root.results, data.results, data.destinations, data.locations]
    .find(Array.isArray) ?? [];
  return rows.flatMap((raw): BookingCarDestination[] => {
    const row = object(raw), coordinates = object(row.coordinates ?? row.location);
    const latitude = number(coordinates.latitude ?? coordinates.lat ?? row.latitude ?? row.lat);
    const longitude = number(coordinates.longitude ?? coordinates.lng ?? coordinates.lon ?? row.longitude ?? row.lng ?? row.lon);
    const name = text(row.name ?? row.label ?? row.city ?? row.display_name ?? row.displayName);
    return name && latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? [{ name, latitude, longitude }]
      : [];
  }).slice(0, 10);
}

/** A provider's first name match may be a different town with the same name. */
export function nearestBookingCarDestination(destinations: BookingCarDestination[], latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const distance = (destination: BookingCarDestination) => {
    const lat = (destination.latitude - latitude) * radians;
    const lon = (destination.longitude - longitude) * radians;
    return Math.sin(lat / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(destination.latitude * radians) * Math.sin(lon / 2) ** 2;
  };
  return destinations.reduce<BookingCarDestination | undefined>((nearest, candidate) =>
    !nearest || distance(candidate) < distance(nearest) ? candidate : nearest, undefined);
}

function bookingCarRows(payload: unknown): unknown[] | undefined {
  const root = object(payload),
    data = object(root.data),
    content = object(data.content),
    lists = [Array.isArray(root.data) ? root.data : undefined, root.results, root.cars, data.search_results, data.searchResults, data.cars, data.results, content.search_results, content.searchResults, content.cars, content.results]
      .filter(Array.isArray) as unknown[][];
  return lists.find((rows) => rows.length > 0) ?? lists[0];
}

export function bookingCarResultsErrorCode(payload: unknown, parsedCount: number): string | undefined {
  const rows = bookingCarRows(payload);
  if (!rows || (rows.length > 0 && parsedCount === 0)) return "BOOKING_CAR_RESPONSE_INVALID";
  return rows.length === 0 ? "BOOKING_CAR_NO_RESULTS" : undefined;
}

export function parseBookingCars(payload: unknown, input: BookingCarSearchInput): BookingCar[] {
  const rows = bookingCarRows(payload) ?? [];
  return rows
    .flatMap((raw, index): BookingCar[] => {
      const row = object(raw),
        vehicle = object(row.vehicle_info ?? row.vehicleInfo ?? row.vehicle ?? row.car),
        supplier = object(row.supplier_info ?? row.supplierInfo ?? row.supplier ?? row.vendor),
        price = object(row.pricing_info ?? row.pricingInfo ?? row.price ?? row.pricing),
        route = object(row.route_info ?? row.routeInfo),
        pickup = object(route.pickup),
        dropoff = object(route.dropoff),
        suitcases = object(vehicle.suitcases);
      const offerId = text(row.vehicle_id ?? row.vehicleId ?? vehicle.id ?? row.id ?? row.search_key, 120),
        id = offerId ?? text(vehicle.v_id, 120),
        name = text(vehicle.v_name ?? vehicle.name ?? vehicle.display_name ?? vehicle.displayName ?? row.vehicle_name ?? row.vehicleName ?? row.name);
      if (!id || !name) return [];
      const rawAmount =
          price.drive_away_price ??
            price.total_price ??
            price.totalPrice ??
            price.price ??
            price.total ?? price.amount ?? row.total_price ?? row.totalPrice ?? row.price,
        amountObject = object(rawAmount),
        amount = number(amountObject.value ?? amountObject.amount ?? rawAmount),
        currency = text(amountObject.currency ?? price.currency ?? price.currency_code ?? row.currency_code ?? row.currency, 3)?.toUpperCase(),
        small = number(suitcases.small) ?? 0,
        big = number(suitcases.big) ?? 0;
      const link = new URL("https://www.booking.com/cars/");
      link.searchParams.set("pickup_date", input.pickupDate);
      link.searchParams.set("dropoff_date", input.dropoffDate);
      if (input.pickupQuery) link.searchParams.set("pickup_location", input.pickupQuery);
      if (input.dropoffQuery) link.searchParams.set("dropoff_location", input.dropoffQuery);
      return [
        {
          // A vehicle/model ID can occur in multiple supplier offers.
          id: `booking-car:${id}${offerId ? "" : `:${index}`}`,
          name,
          supplier: text(supplier.name ?? supplier.supplier_name ?? supplier.display_name ?? row.supplier_name),
          category: text(
            vehicle.group ?? vehicle.category ?? vehicle.car_category ?? row.car_category,
            80,
          ),
          transmission: text(vehicle.transmission ?? vehicle.transmission_type ?? row.transmission, 40),
          amount,
          currency,
          deposit: number(price.deposit ?? row.deposit),
          seats: number(vehicle.seats ?? vehicle.seat_count),
          baggage: small + big || number(vehicle.bags ?? vehicle.baggage),
          freeCancellation: vehicle.free_cancellation === 1 || vehicle.free_cancellation === true || row.free_cancellation === true,
          pickupName: text(pickup.name ?? pickup.address),
          dropoffName: text(dropoff.name ?? dropoff.address),
          imageUrl: https(vehicle.image_url ?? vehicle.imageUrl ?? vehicle.image?.url ?? row.image_url),
          sourceUrl: https(row.forward_url ?? row.booking_url ?? row.url?.web ?? row.url ?? row.deep_link_url ?? row.deepLink) ?? link.toString(),
        },
      ];
    })
    .slice(0, 20);
}
