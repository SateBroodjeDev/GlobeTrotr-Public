import type { TravelItem, TravelOption, TravelOptionDetails } from "./types";

export const MAX_COMPARE_OPTIONS = 4;

export function safeOptionUrl(value?: string) {
  if (!value?.trim()) return undefined;
  if (value.trim().length > 2048) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeTravelOption(option: TravelOption): TravelOption {
  const amount = Number(option.amount);
  const duration = Number(option.durationMinutes);
  const distance = Number(option.distanceKm);
  return {
    ...option,
    title: option.title.trim().slice(0, 160),
    provider: option.provider?.trim().slice(0, 120) || undefined,
    amount:
      option.amount == null
        ? undefined
        : Number.isFinite(amount) && amount >= 0
          ? amount
          : undefined,
    currency: /^[A-Z]{3}$/.test(option.currency ?? "") ? option.currency : undefined,
    durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
    distanceKm:
      option.distanceKm == null
        ? undefined
        : Number.isFinite(distance) && distance >= 0
          ? distance
          : undefined,
    cancellation: option.cancellation?.trim().slice(0, 500) || undefined,
    notes: option.notes?.trim().slice(0, 2000) || undefined,
    sourceUrl: safeOptionUrl(option.sourceUrl),
    details: normalizeOptionDetails(option.details),
  };
}

function normalizeOptionDetails(details?: TravelOptionDetails): TravelOptionDetails | undefined {
  if (!details) return undefined;
  const text = (value: string | undefined, length = 160) =>
    value?.trim().slice(0, length) || undefined;
  const positiveInteger = (value: number | undefined) =>
    Number.isFinite(value) && Number(value) > 0 ? Math.round(Number(value)) : undefined;
  const nonNegative = (value: number | undefined) =>
    Number.isFinite(value) && Number(value) >= 0 ? Number(value) : undefined;
  const normalized: TravelOptionDetails = {
    startTime: /^\d{2}:\d{2}$/.test(details.startTime ?? "") ? details.startTime : undefined,
    endTime: /^\d{2}:\d{2}$/.test(details.endTime ?? "") ? details.endTime : undefined,
    flightNumber: text(details.flightNumber, 24),
    departureName: text(details.departureName),
    arrivalName: text(details.arrivalName),
    locationName: text(details.locationName),
    transportMode: (
      [
        "car",
        "motorcycle",
        "camper",
        "public_transport",
        "train",
        "bus",
        "ferry",
        "taxi",
        "bicycle",
        "walking",
        "other",
      ] as const
    ).find((mode) => mode === details.transportMode),
    luggageIncluded: details.luggageIncluded,
    roomType: text(details.roomType, 120),
    guests: positiveInteger(details.guests),
    rooms: positiveInteger(details.rooms),
    taxesAndFees: nonNegative(details.taxesAndFees),
    breakfastIncluded: details.breakfastIncluded,
    vehicle: text(details.vehicle, 120),
    vehicleCategory: text(details.vehicleCategory, 80),
    deposit: nonNegative(details.deposit),
    insurance: text(details.insurance, 160),
    excess: nonNegative(details.excess),
    activityCategory: text(details.activityCategory, 100),
    participants: positiveInteger(details.participants),
  };
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

export function convertOptionToBooking(
  options: TravelOption[],
  travelItems: TravelItem[],
  optionId: string,
  createId: () => string,
) {
  const option = options.find((item) => item.id === optionId);
  if (!option) return { options, travelItems, changed: false };
  if (option.convertedTravelItemId) {
    return { options, travelItems, changed: false };
  }
  const travelItemId = createId();
  const travelItem: TravelItem = {
    id: travelItemId,
    type: option.type,
    title: option.title,
    date: option.startDate,
    endDate: option.endDate,
    provider: option.provider,
    flightNumber: option.details?.flightNumber,
    amount: option.amount,
    currency: option.currency,
    notes:
      [
        option.details?.departureName && option.details?.arrivalName
          ? `${option.details.departureName} → ${option.details.arrivalName}`
          : option.details?.locationName,
        option.cancellation,
        option.notes,
      ]
        .filter(Boolean)
        .join("\n") || undefined,
    details: {
      startTime: option.details?.startTime,
      endTime: option.details?.endTime,
      vehicle: option.details?.vehicle,
      vehicleCategory: option.details?.vehicleCategory,
      deposit: option.details?.deposit,
      insurance: option.details?.insurance,
      excess: option.details?.excess,
      distanceKm: option.distanceKm,
      transportMode: option.details?.transportMode,
    },
  };
  return {
    options: options.map((item) =>
      item.id === optionId
        ? { ...item, status: "selected" as const, convertedTravelItemId: travelItemId }
        : item,
    ),
    travelItems: [...travelItems, travelItem],
    changed: true,
  };
}
