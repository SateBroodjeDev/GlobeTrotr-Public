import type { PlanId } from "./types";

export type MeteredProvider = "weather" | "flight_lookup" | "routing";

export const DAILY_PROVIDER_LIMITS: Record<PlanId, Record<MeteredProvider, number>> = {
  free: { weather: 10, flight_lookup: 3, routing: 25 },
  pro: { weather: 100, flight_lookup: 30, routing: 250 },
  agency: { weather: 1_000, flight_lookup: 300, routing: 2_500 },
};

export function providerDailyLimit(plan: PlanId, provider: MeteredProvider) {
  return DAILY_PROVIDER_LIMITS[plan][provider];
}

export function workerRetryDelaySeconds(attempt: number) {
  return Math.min(3_600, 30 * 2 ** Math.max(0, Math.min(attempt - 1, 10)));
}

export type ObjectStorageProvider = "supabase" | "hetzner_s3";
export type StoredObjectReference = {
  provider: ObjectStorageProvider;
  bucket: string;
  objectKey: string;
};

export function isSafeObjectReference(reference: StoredObjectReference) {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(reference.bucket)
    && !reference.objectKey.startsWith("/")
    && !reference.objectKey.includes("..")
    && reference.objectKey.length > 2
    && reference.objectKey.length <= 512;
}
