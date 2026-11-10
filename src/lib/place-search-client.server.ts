import { normalizePlaceAddress, normalizePlaceQuery, type NominatimPlace, type PlaceAddressQuery } from "./place-search.ts";

type Dependencies = {
  fetch: typeof fetch;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
};

/** Single web process: shared queue and cache across all authenticated users. */
export function createPlaceSearchClient(endpoint: string, dependencies: Dependencies) {
  const base = new URL(endpoint);
  if (base.protocol !== "https:" || base.username || base.password || base.hash)
    throw new Error("PLACE_SEARCH_ENDPOINT_INVALID");
  const cache = new Map<string, { expires: number; rows: NominatimPlace[] }>();
  const pending = new Map<string, Promise<NominatimPlace[]>>();
  let tail = Promise.resolve();
  let lastStarted = -Infinity;

  function requestPlaces(
    query: string,
    language: "nl" | "en",
    point?: { lat: number; lon: number },
    address?: PlaceAddressQuery,
  ) {
    const key = `${point ? "reverse" : address ? "address" : "search"}:${language}:${address ? JSON.stringify(address).toLocaleLowerCase() : query.trim().toLocaleLowerCase()}`;
    const saved = cache.get(key);
    if (saved && saved.expires > dependencies.now()) return Promise.resolve(saved.rows);
    const underway = pending.get(key);
    if (underway) return underway;
    if (pending.size >= 25) return Promise.reject(new Error("PLACE_SEARCH_BUSY"));
    const queuedAt = dependencies.now();

    const request = tail
      .then(async () => {
        const delay = 1_000 - (dependencies.now() - lastStarted);
        if (dependencies.now() - queuedAt + Math.max(0, delay) > 15_000) throw Error("PLACE_SEARCH_BUSY");
        if (delay > 0) await dependencies.wait(delay);
        lastStarted = dependencies.now();
        const url = new URL(base);
        if (point) {
          url.pathname = url.pathname.replace(/\/search(?:\.php)?\/?$/, "/reverse");
          url.search = "";
        }
        if (address) for (const key of ["q", "street", "city", "country"]) url.searchParams.delete(key);
        const parameters = point
          ? { lat: String(point.lat), lon: String(point.lon), zoom: "18" }
          : address ? { limit: "6", ...Object.fromEntries(Object.entries(address).filter(([, value]) => value)) }
          : { limit: "6", q: query.trim() };
        for (const [name, value] of Object.entries({
          format: "jsonv2",
          addressdetails: "1",
          namedetails: "1",
          "accept-language": language,
          ...parameters,
        }))
          url.searchParams.set(name, value);
        const response = await dependencies.fetch(url, {
          headers: {
            Accept: "application/json",
            "Accept-Language": language,
            "User-Agent": "GlobeTrotr/1.0 (https://globetrotr.nl/contact)",
          },
          signal: AbortSignal.timeout(8_000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("PLACE_SEARCH_FAILED");
        const reader = response.body?.getReader();
        if (!reader) throw Error("PLACE_SEARCH_RESPONSE_INVALID");
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 524_288) throw Error("PLACE_SEARCH_RESPONSE_INVALID");
            chunks.push(chunk.value);
          }
        } finally { await reader.cancel().catch(() => undefined); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let payload: unknown;
        try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
        catch { throw Error("PLACE_SEARCH_RESPONSE_INVALID"); }
        const rows =
          point &&
          payload &&
          typeof payload === "object" &&
          !Array.isArray(payload) &&
          !("error" in payload)
            ? [payload]
            : payload;
        if (!Array.isArray(rows) || rows.length > 40) throw new Error("PLACE_SEARCH_RESPONSE_INVALID");
        if (cache.size >= 256) cache.delete(cache.keys().next().value!);
        cache.set(key, { rows, expires: dependencies.now() + (rows.length ? 86_400_000 : 60_000) });
        return rows as NominatimPlace[];
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
    tail = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }
  return Object.assign((query: string, language: "nl" | "en") => requestPlaces(normalizePlaceQuery(query), language), {
    address(input: PlaceAddressQuery, language: "nl" | "en") {
      const address = normalizePlaceAddress(input);
      return requestPlaces("", language, undefined, address).then(rows => rows.length ? rows
        : requestPlaces([address.street, address.city, address.country].filter(Boolean).join(", "), language));
    },
    reverse(lat: number, lon: number, language: "nl" | "en") {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      )
        return Promise.reject(new Error("PLACE_POINT_INVALID"));
      return requestPlaces(`${lat},${lon}`, language, { lat, lon });
    },
  });
}

let search: ReturnType<typeof createPlaceSearchClient> | undefined;
export function fetchNominatimPlaces(query: string, language: "nl" | "en", address?: PlaceAddressQuery) {
  search ??= createPlaceSearchClient(
    process.env.NOMINATIM_API_URL || "https://nominatim.openstreetmap.org/search",
    {
      fetch,
      now: Date.now,
      wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    },
  );
  return address ? search.address(address, language) : search(query, language);
}

export async function fetchNominatimAddress(lat: number, lon: number, language: "nl" | "en") {
  // Initialise the same process-wide queue; reverse lookups cannot bypass its rate limit.
  search ??= createPlaceSearchClient(
    process.env.NOMINATIM_API_URL || "https://nominatim.openstreetmap.org/search",
    {
      fetch,
      now: Date.now,
      wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    },
  );
  return search.reverse(lat, lon, language);
}
