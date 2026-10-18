import type { NominatimPlace } from "./place-search.ts";

type Dependencies = {
  fetch: typeof fetch;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
};

/** Single web process: shared queue and cache across all authenticated users. */
export function createPlaceSearchClient(endpoint: string, dependencies: Dependencies) {
  const base = new URL(endpoint);
  if (base.protocol !== "https:" || base.username || base.password || base.hash) throw new Error("PLACE_SEARCH_ENDPOINT_INVALID");
  const cache = new Map<string, { expires: number; rows: NominatimPlace[] }>();
  const pending = new Map<string, Promise<NominatimPlace[]>>();
  let tail = Promise.resolve();
  let lastStarted = -Infinity;

  return function search(query: string, language: "nl" | "en") {
    const key = `${language}:${query.trim().toLocaleLowerCase()}`;
    const saved = cache.get(key);
    if (saved && saved.expires > dependencies.now()) return Promise.resolve(saved.rows);
    const underway = pending.get(key);
    if (underway) return underway;
    if (pending.size >= 25) return Promise.reject(new Error("PLACE_SEARCH_BUSY"));

    const request = tail.then(async () => {
      const delay = 1_000 - (dependencies.now() - lastStarted);
      if (delay > 0) await dependencies.wait(delay);
      lastStarted = dependencies.now();
      const url = new URL(base);
      for (const [name, value] of Object.entries({ format: "jsonv2", limit: "6", addressdetails: "1", namedetails: "1", "accept-language": language, q: query.trim() })) url.searchParams.set(name, value);
      const response = await dependencies.fetch(url, {
        headers: { Accept: "application/json", "Accept-Language": language, "User-Agent": "GlobeTrotr/1.0 (https://globetrotr.nl/contact)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("PLACE_SEARCH_FAILED");
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("PLACE_SEARCH_RESPONSE_INVALID");
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, { rows, expires: dependencies.now() + 86_400_000 });
      return rows as NominatimPlace[];
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    tail = request.then(() => undefined, () => undefined);
    return request;
  };
}

let search: ReturnType<typeof createPlaceSearchClient> | undefined;
export function fetchNominatimPlaces(query: string, language: "nl" | "en") {
  search ??= createPlaceSearchClient(process.env.NOMINATIM_API_URL || "https://nominatim.openstreetmap.org/search", {
    fetch,
    now: Date.now,
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });
  return search(query, language);
}
