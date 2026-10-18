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

function isAvailableHotel(row: Record<string, any>) {
  const property = record(row.property);
  const availability = record(row.availability ?? property.availability);
  const explicit = [row.isAvailable, row.available, property.isAvailable, property.available, availability.available]
    .find((value) => typeof value === "boolean");
  if (explicit === false) return false;
  if ([row.isSoldOut, row.soldOut, property.isSoldOut, property.soldOut].some((value) => value === true)) return false;
  const status = String(availability.status ?? row.availabilityStatus ?? property.availabilityStatus ?? "").toLowerCase();
  return !["sold_out", "soldout", "unavailable", "not_available", "closed"].includes(status);
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
      if (!name || !id || !isAvailableHotel(row)) return [];
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
