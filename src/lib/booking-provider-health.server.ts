export type BookingProviderKind = "hotels" | "cars";
export type BookingProviderState = {
  configured: boolean;
  status: "unknown" | "ok" | "no_results" | "invalid_input" | "auth" | "quota" | "timeout" | "unavailable";
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastErrorCode?: string;
  remaining?: number;
  limit?: number;
  used?: number;
};

const states: Record<BookingProviderKind, BookingProviderState> = {
  hotels: { configured: false, status: "unknown" },
  cars: { configured: false, status: "unknown" },
};

export function recordBookingProvider(kind: BookingProviderKind, update: Partial<BookingProviderState>) {
  states[kind] = { ...states[kind], ...update, lastAttemptAt: new Date().toISOString() };
}

export function bookingProviderHealth(configured: boolean) {
  return Object.fromEntries(Object.entries(states).map(([kind, state]) => [kind, { ...state, configured }])) as Record<BookingProviderKind, BookingProviderState>;
}

export function rapidApiRemaining(headers: Headers) {
  const value = headers.get("x-ratelimit-requests-remaining") ?? headers.get("x-ratelimit-remaining");
  return quotaValue(value);
}

function quotaValue(value: string | null) {
  if (value === null || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function rapidApiQuota(headers: Headers) {
  const remaining = rapidApiRemaining(headers);
  const limit = quotaValue(headers.get("x-ratelimit-requests-limit") ?? headers.get("x-ratelimit-limit"));
  return { remaining, limit, used: limit != null && remaining != null ? Math.max(0, limit - remaining) : undefined };
}
