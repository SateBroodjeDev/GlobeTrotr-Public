const BOOKING_HOST = "booking-com18.p.rapidapi.com";

export type BookingHotelSearchInput = {
  lat: number;
  lon: number;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  rooms: number;
  currency: string;
  language: "nl" | "en";
};
export type BookingHotel = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
  stars?: string;
  reviewScore?: number;
  reviewCount?: number;
  amount?: number;
  currency?: string;
  taxesAndFees?: number;
  photoUrl?: string;
  sourceUrl: string;
  availability: "available" | "unknown";
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function finite(value: unknown) {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function httpUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function hotelAvailability(row: Record<string, any>): "available" | "unavailable" | "unknown" {
  const sources = [row, record(row.property), record(row.basicPropertyData)];
  const availability = sources.map(source => record(source.availability));
  const flag = (value: unknown) => value === true || value === 1 || value === "1" || value === "true"
    ? true : value === false || value === 0 || value === "0" || value === "false" ? false : undefined;
  const available = [...sources, ...availability].flatMap(source =>
    [source.isAvailable, source.is_available, source.available].map(flag));
  const sold = sources.flatMap(source => [source.isSoldOut, source.is_sold_out, source.soldOut, source.sold_out, source.soldout].map(flag));
  const status = [...sources, ...availability].map(source => String(
    source.availabilityStatus ?? source.availability_status ?? source.status ?? "").trim().toLowerCase().replace(/[ -]+/g, "_"));
  const roomCounts = sources.flatMap(source => [source.availableRooms, source.available_rooms, source.roomsAvailable, source.rooms_available]);
  if (available.includes(false) || sold.includes(true) || roomCounts.some(value => finite(value) === 0)
    || status.some(value => ["sold_out", "soldout", "unavailable", "not_available", "closed"].includes(value))) return "unavailable";
  return available.includes(true) || status.some(value => ["available", "bookable"].includes(value)) ? "available" : "unknown";
}

export function bookingHotelsRequest(input: BookingHotelSearchInput, host = BOOKING_HOST) {
  if (host !== BOOKING_HOST) throw new Error("BOOKING_RAPIDAPI_HOST_INVALID");
  const latitudeRadius = 15 / 111.32;
  const longitudeRadius = 15 / (111.32 * Math.max(0.2, Math.cos((input.lat * Math.PI) / 180)));
  const url = new URL(`https://${host}/stays/search-by-geo`);
  const parameters: Record<string, string> = {
    swLat: String(input.lat - latitudeRadius),
    swLng: String(input.lon - longitudeRadius),
    neLat: String(input.lat + latitudeRadius),
    neLng: String(input.lon + longitudeRadius),
    checkinDate: input.arrivalDate,
    checkoutDate: input.departureDate,
    adults: String(input.adults),
    rooms: String(input.rooms),
    minPrice: "0",
    maxPrice: "100000",
    currencyCode: input.currency,
    languageCode: input.language === "nl" ? "nl" : "en-gb",
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

export function parseBookingHotels(
  payload: unknown,
  input: BookingHotelSearchInput,
): BookingHotel[] {
  const root = record(payload),
    rawData = root.data,
    data = record(rawData),
    content = record(data.content),
    rows =
      [
        data.results,
        data.hotels,
        data.search_results,
        content.results,
        content.hotels,
        root.results,
        root.hotels,
        Array.isArray(rawData) ? rawData : undefined,
      ].find(Array.isArray) ?? [];
  return rows
    .flatMap((raw, index): BookingHotel[] => {
      const row = record(raw),
        property = record(row.property),
        basic = record(row.basicPropertyData),
        displayName = record(row.displayName),
        location = record(basic.location),
        coordinates = record(location.coordinates ?? basic.coordinates ?? row.coordinates),
        name = String(displayName.text ?? basic.name ?? property.name ?? row.name ?? "")
          .trim()
          .slice(0, 160),
        id = String(row.id ?? basic.id ?? row.hotel_id ?? property.id ?? `${name}:${index}`)
          .trim()
          .slice(0, 100);
      const availability = hotelAvailability(row);
      if (!name || !id || availability === "unavailable") return [];
      const lat =
          finite(
            coordinates.latitude ??
              coordinates.lat ??
              location.latitude ??
              basic.latitude ??
              property.latitude ??
              property.position?.latitude ??
              row.latitude,
          ),
        lon =
          finite(
            coordinates.longitude ??
              coordinates.lng ??
              coordinates.lon ??
              location.longitude ??
              basic.longitude ??
              property.longitude ??
              property.position?.longitude ??
              row.longitude,
          );
      if (lat === undefined || lon === undefined || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
      const priceDisplay = record(row.priceDisplayInfo),
        displayPrice = record(priceDisplay.displayPrice),
        amountPerStay = record(displayPrice.amountPerStay),
        price = record(row.priceBreakdown ?? property.priceBreakdown),
        gross = Object.keys(amountPerStay).length ? amountPerStay : record(price.grossPrice),
        excluded = record(price.excludedPrice);
      const reviews = record(basic.reviews ?? property.reviews ?? row.reviews),
        photos = record(basic.photos),
        mainPhoto = record(photos.main),
        lowResolution = record(mainPhoto.lowResJpegUrl),
        starRating = record(basic.starRating);
      const amount = finite(gross.amountUnformatted ?? gross.value ?? gross.amount);
      if (amount === undefined || amount <= 0) return [];
      const bookingUrl = new URL("https://www.booking.com/searchresults.html");
      for (const [key, value] of Object.entries({
        ss: name,
        checkin: input.arrivalDate,
        checkout: input.departureDate,
        group_adults: String(input.adults),
        no_rooms: String(input.rooms),
        selected_currency: input.currency,
      }))
        bookingUrl.searchParams.set(key, value);
      const sourceUrl = new URL(httpUrl(row.url ?? row.shareUrl ?? basic.url ?? property.url) ?? bookingUrl.toString());
      if (/(^|\.)booking\.com$/i.test(sourceUrl.hostname)) {
        for (const key of ["checkin", "checkout", "group_adults", "no_rooms", "selected_currency"])
          sourceUrl.searchParams.set(key, bookingUrl.searchParams.get(key)!);
      }
      return [
        {
          id: `booking:${id}`,
          availability,
          name,
          kind: String(
            basic.propertyType ??
              property.propertyType ??
              property.propertyTypeName ??
              "accommodation",
          ).slice(0, 40),
          lat,
          lon,
          stars: finite(
            starRating.value ??
              basic.starRating ??
              property.propertyClass ??
              property.accuratePropertyClass,
          )?.toString(),
          reviewScore: finite(reviews.totalScore ?? property.reviewScore),
          reviewCount: finite(reviews.reviewsCount ?? reviews.totalCount ?? property.reviewCount),
          amount,
          currency:
            typeof gross.currency === "string"
              ? gross.currency.toUpperCase().slice(0, 3)
              : undefined,
          taxesAndFees: finite(excluded.value),
          photoUrl: httpUrl(
            lowResolution.absoluteUrl ??
              mainPhoto.url ??
              record(property.photoUrls?.[0]).url ??
              property.photoUrls?.[0] ??
              property.photoUrls?.[0]?.src,
          ),
          sourceUrl: sourceUrl.toString(),
        },
      ];
    })
    .slice(0, 20);
}

/** An authoritative empty search must not be replaced with unverified map listings. */
export async function resolveHotelSearch<T>(booking: () => Promise<T[] | undefined>, map: () => Promise<T[]>) {
  let bookingUnavailable = false;
  let bookingStatus: "ok" | "no_results" | "timeout" | "unavailable" = "ok";
  try {
    const results = await booking();
    if (results !== undefined) return { results, provider: "booking" as const, bookingUnavailable,
      bookingStatus: results.length ? "ok" as const : "no_results" as const };
    bookingStatus = "unavailable";
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["BOOKING_HOTEL_AUTH", "BOOKING_HOTEL_QUOTA", "BOOKING_HOTEL_INVALID_INPUT"].includes(code)) throw error;
    bookingUnavailable = true;
    bookingStatus = code === "BOOKING_HOTEL_TIMEOUT" ? "timeout" : "unavailable";
  }
  return { results: await map(), provider: "openstreetmap" as const, bookingUnavailable, bookingStatus };
}
