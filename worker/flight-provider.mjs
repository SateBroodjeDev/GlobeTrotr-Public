const ALLOWED_HOST = "aerodatabox.p.rapidapi.com";
const clean = (value) => typeof value === "string" ? value.trim().slice(0, 120) || null : null;
const moment = (value) => clean(value?.local) || clean(value?.utc);

export function flightProviderConfiguration(env) {
  const requested = env.FLIGHT_DATA_PROVIDER?.trim().toLowerCase();
  const provider = requested || (env.AERODATABOX_RAPIDAPI_KEY?.trim() ? "aerodatabox" : "skylink");
  if (!new Set(["aerodatabox", "skylink"]).has(provider)) return { provider, configured: false };
  return { provider, configured: provider === "aerodatabox" ? Boolean(env.AERODATABOX_RAPIDAPI_KEY?.trim()) : Boolean(env.SKYLINK_API_KEY?.trim()) };
}

export function aeroDataBoxMonitorState(payload, departureIata) {
  if (!Array.isArray(payload)) return null;
  const iata = clean(departureIata)?.toUpperCase();
  const flight = (iata ? payload.find((item) => item?.departure?.airport?.iata?.toUpperCase() === iata) : null) || payload[0];
  if (!flight || typeof flight !== "object") return null;
  const point = (value, arrival = false) => value && typeof value === "object" ? {
    airport: clean(value.airport?.iata) || clean(value.airport?.icao),
    airportName: clean(value.airport?.name),
    scheduled: moment(value.scheduledTime),
    actual: arrival ? moment(value.actualTime) : moment(value.actualTime) || moment(value.revisedTime),
    estimated: arrival ? moment(value.revisedTime) || moment(value.actualTime) : null,
    terminal: clean(value.terminal), gate: clean(value.gate),
    ...(arrival
      ? { baggage: clean(value.baggageBelt) }
      : { checkin: clean(value.checkInDesk) }),
  } : {};
  return { status: clean(flight.status), departure: point(flight.departure), arrival: point(flight.arrival, true) };
}

export async function fetchMonitoredFlight(env, flight) {
  const configuration = flightProviderConfiguration(env);
  if (!configuration.configured) throw Object.assign(new Error("FLIGHT_PROVIDER_NOT_CONFIGURED"), { code: "FLIGHT_PROVIDER_NOT_CONFIGURED" });
  if (configuration.provider === "skylink") {
    const response = await fetch(`https://data.skylinkapi.com/v3.1/flight_status/${encodeURIComponent(flight.flight_number)}`, { headers: { "x-api-key": env.SKYLINK_API_KEY.trim() }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Object.assign(new Error("FLIGHT_PROVIDER_FAILED"), { code: `FLIGHT_HTTP_${response.status}` });
    const payload = await response.json();
    if (!payload?.flight_number) throw Object.assign(new Error("FLIGHT_RESPONSE_INVALID"), { code: "FLIGHT_RESPONSE_INVALID" });
    return { provider: "skylink", payload };
  }
  const host = env.AERODATABOX_RAPIDAPI_HOST?.trim() || ALLOWED_HOST;
  if (host !== ALLOWED_HOST) throw Object.assign(new Error("AERODATABOX_HOST_INVALID"), { code: "AERODATABOX_HOST_INVALID" });
  const date = String(flight.flight_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error("FLIGHT_DATE_INVALID"), { code: "FLIGHT_DATE_INVALID" });
  const query = new URLSearchParams({ withLocation: "false", withAircraftImage: "false", dateLocalRole: "Departure" });
  const response = await fetch(`https://${host}/flights/number/${encodeURIComponent(flight.flight_number)}/${date}?${query}`, { headers: { "X-RapidAPI-Key": env.AERODATABOX_RAPIDAPI_KEY.trim(), "X-RapidAPI-Host": host, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Object.assign(new Error("FLIGHT_PROVIDER_FAILED"), { code: `FLIGHT_HTTP_${response.status}` });
  const payload = await response.json();
  const state = aeroDataBoxMonitorState(payload, flight.departure_iata);
  if (!state) throw Object.assign(new Error("FLIGHT_RESPONSE_INVALID"), { code: "FLIGHT_RESPONSE_INVALID" });
  return { provider: "aerodatabox", payload, state };
}
