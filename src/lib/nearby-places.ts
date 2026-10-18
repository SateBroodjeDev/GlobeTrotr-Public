export type NearbyPlaceCategory = "food" | "sights" | "activities" | "practical";

const FILTERS: Record<NearbyPlaceCategory, string[]> = {
  food: [`["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream)$"]`],
  sights: [`["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|artwork)$"]`],
  activities: [`["leisure"~"^(sports_centre|water_park|swimming_pool|park|nature_reserve|playground|pitch|fitness_centre)$"]`, `["tourism"="theme_park"]`],
  practical: [`["amenity"~"^(pharmacy|hospital|clinic|fuel|atm|car_rental)$"]`, `["shop"="supermarket"]`],
};

export function isNearbyPlaceCategory(value: string): value is NearbyPlaceCategory {
  return Object.hasOwn(FILTERS, value);
}

export function nearbyPlacesQuery(category: NearbyPlaceCategory, lat:number, lon:number, radius=15_000) {
  const boundedRadius=Math.min(20_000,Math.max(500,Math.round(radius)));
  const selectors=FILTERS[category].map(filter=>`nwr${filter}["name"](around:${boundedRadius},${lat},${lon});`);
  return `[out:json][timeout:10][maxsize:3145728];${selectors.length>1?`(${selectors.join("")});`:selectors[0]}out center tags 50;`;
}

export function overpassEndpoints(configured?: string) {
  const preferred=configured?.split(",").map(value=>value.trim()).filter(Boolean)??[];
  return [...new Set([...preferred,
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ])].filter(value=>{try{return new URL(value).protocol==="https:"}catch{return false}});
}

/** Empty results are valid; provider errors and incomplete responses are not. */
export function overpassElements(payload: unknown): Record<string, any>[] | undefined {
  if (!payload || typeof payload!=="object" || Array.isArray(payload)) return undefined;
  const result=payload as Record<string, unknown>;
  if (result.remark || !Array.isArray(result.elements)) return undefined;
  if (result.elements.some(element=>!element || typeof element!=="object" || Array.isArray(element))) return undefined;
  return result.elements as Record<string, any>[];
}
