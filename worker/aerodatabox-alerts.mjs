import { createHash, timingSafeEqual } from "node:crypto";
import { aeroDataBoxMonitorState } from "./flight-provider.mjs";

const HOST = "aerodatabox.p.rapidapi.com";
const cleanNumber = (value) =>
  typeof value === "string" ? value.toUpperCase().replace(/\s+/g, "") : "";

export function alertConfiguration(env) {
  const enabled = env.AERODATABOX_ALERTS_ENABLED?.trim().toLowerCase() === "true";
  return {
    enabled,
    configured: Boolean(
      enabled &&
        env.AERODATABOX_RAPIDAPI_KEY?.trim() &&
        env.AERODATABOX_ALERT_WEBHOOK_URL?.trim() &&
        env.AERODATABOX_ALERT_WEBHOOK_SECRET?.trim(),
    ),
    webhookUrl: env.AERODATABOX_ALERT_WEBHOOK_URL?.trim(),
  };
}

export function validAlertSecret(supplied, expected) {
  if (!supplied || !expected) return false;
  const left = createHash("sha256").update(String(supplied)).digest();
  const right = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

export function extractAlertFlights(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.flights)
      ? payload.flights
      : Array.isArray(payload?.data?.flights)
        ? payload.data.flights
        : Array.isArray(payload?.data)
          ? payload.data
          : payload?.data?.flight
            ? [payload.data.flight]
      : payload?.flight
        ? [payload.flight]
        : payload?.number && (payload?.departure || payload?.arrival)
          ? [payload]
          : [];
  return candidates.filter((flight) => cleanNumber(flight?.number));
}

export function extractAlertBalance(payload) {
  const values = [
    payload?.creditsRemaining,
    payload?.remainingBalance,
    payload?.remainingCredits,
    payload?.balance,
    payload?.balance?.credits,
    payload?.balance?.creditsRemaining,
    payload?.data?.remainingBalance,
    payload?.data?.remainingCredits,
    payload?.data?.creditsRemaining,
  ];
  const value = values.find((candidate) => Number.isFinite(Number(candidate)));
  return value === undefined ? null : Math.max(0, Math.floor(Number(value)));
}

export function alertFlightDate(flight) {
  const raw = flight?.departure?.scheduledTime?.local || flight?.departure?.scheduledTime?.utc;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

export function normalizeAlertFlight(flight) {
  const state = aeroDataBoxMonitorState([flight]);
  return state ? { flightNumber: cleanNumber(flight.number), flightDate: alertFlightDate(flight), state } : null;
}

const headers = (env) => ({
  "X-RapidAPI-Key": env.AERODATABOX_RAPIDAPI_KEY.trim(),
  "X-RapidAPI-Host": HOST,
  "Content-Type": "application/json",
  Accept: "application/json",
});

export async function createAlertSubscription(env, flightNumber) {
  const url = `https://${HOST}/subscriptions/webhook/FlightByNumber/${encodeURIComponent(cleanNumber(flightNumber))}?useCredits=true`;
  const response = await fetch(url, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ url: env.AERODATABOX_ALERT_WEBHOOK_URL.trim(), maxDeliveryRetries: 1 }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error("AERODATABOX_ALERT_CREATE_FAILED"), { code: `AERO_ALERT_HTTP_${response.status}` });
  const id = payload?.id || payload?.subscriptionId || payload?.subscription?.id;
  if (!id) throw Object.assign(new Error("AERODATABOX_ALERT_ID_MISSING"), { code: "AERO_ALERT_ID_MISSING" });
  return String(id);
}

export async function fetchAlertBalance(env) {
  const response = await fetch(`https://${HOST}/subscriptions/balance`, {
    headers: headers(env),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error("AERODATABOX_ALERT_BALANCE_FAILED"), { code: `AERO_ALERT_HTTP_${response.status}` });
  const payloadBalance = extractAlertBalance(payload);
  if (payloadBalance !== null) return payloadBalance;
  const quotaHeader = [...response.headers.entries()].find(([name, value]) =>
    name.toLowerCase().startsWith("x-ratelimit-") &&
    name.toLowerCase().endsWith("-remaining") &&
    Number.isFinite(Number(value)),
  );
  return quotaHeader ? Math.max(0, Math.floor(Number(quotaHeader[1]))) : null;
}

export async function deleteAlertSubscription(env, id) {
  const response = await fetch(`https://${HOST}/subscriptions/webhook/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(env),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404)
    throw Object.assign(new Error("AERODATABOX_ALERT_DELETE_FAILED"), { code: `AERO_ALERT_HTTP_${response.status}` });
}
