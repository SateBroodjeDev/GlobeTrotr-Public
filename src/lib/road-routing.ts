import type { CachedRoadSegment, Stop, TransportMode, TravelItem, TripMemberRole } from "@/lib/types";
import type { RouteLeg, RouteProposal } from "@/lib/route-optimizer";
import { resolveEffectiveTripAccess, type AgencyPermissionMap } from "./agency-permissions.ts";
export type { CachedRoadSegment } from "@/lib/types";

export type RoadTravelMode = "car" | "bicycle" | "walking";
export type RoadRouteOptions = {
  mode: RoadTravelMode;
  avoidTolls: boolean;
  avoidFerries: boolean;
  restEveryMinutes: number;
};
export type RoadRouteLeg = RouteLeg & { fromStopId?: string; toStopId?: string };
export type RoadRoute = { distanceKm: number; durationMinutes: number; legs: RoadRouteLeg[]; segments?: CachedRoadSegment[] };
export type SkippedRoadLeg = { fromStopId: string; toStopId: string; mode?: TransportMode; reason: "non_road" | "unconfigured" };
export type RoadRouteGroup = { stops: Stop[]; mode: RoadTravelMode };
export type TripRoadRoutes = { segments: CachedRoadSegment[]; skippedLegs: SkippedRoadLeg[]; providerRequestCount: number };
export type RestStopSuggestion = { afterStopId: string; beforeStopId: string; afterMinutes: number; label: string };
export type RoadRouteProposal = RouteProposal & {
  originalLegs: RoadRouteLeg[];
  proposedLegs: RoadRouteLeg[];
  source: "openrouteservice";
  mode: RoadTravelMode;
  avoidTolls: boolean;
  avoidFerries: boolean;
  restStops: RestStopSuggestion[];
  providerRequestCount: number;
  originalRoadSegments: CachedRoadSegment[];
  proposedRoadSegments: CachedRoadSegment[];
  skippedLegs: SkippedRoadLeg[];
};

const profiles: Record<RoadTravelMode, string> = { car: "driving-car", bicycle: "cycling-regular", walking: "foot-walking" };
export const ROAD_ROUTE_ERROR_CODES = [
  "ROUTING_NOT_CONFIGURED", "ROUTING_KEY_INVALID", "PROVIDER_QUOTA_EXCEEDED",
  "PROVIDER_QUOTA_UNAVAILABLE", "PROVIDER_DISABLED", "ROUTE_NOT_FOUND",
  "ROUTING_TIMEOUT", "ROUTING_UNAVAILABLE", "ROUTING_RESPONSE_INVALID",
  "ROUTE_STOPS_INVALID", "ROUTE_STOPS_UNAVAILABLE", "TRIP_PLANNER_REQUIRED",
  "INVALID_ROUTE_REQUEST",
  "NO_ROAD_SEGMENTS", "TRIP_ACCESS_UNAVAILABLE",
] as const;
export type RoadRouteErrorCode = typeof ROAD_ROUTE_ERROR_CODES[number];

export function isRoadRouteStopId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 160
    && [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
}

export function roadRouteErrorCode(error: unknown): RoadRouteErrorCode | undefined {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return ROAD_ROUTE_ERROR_CODES.find((code) => message.includes(code));
}

export function roadRoutingProfile(mode: RoadTravelMode) { return profiles[mode]; }

export function roadRoutingEndpoint(mode: RoadTravelMode) {
  return `https://api.heigit.org/openrouteservice/v2/directions/${roadRoutingProfile(mode)}/geojson`;
}

export function roadRoutingProviderErrorCode(status: number, payload: unknown): RoadRouteErrorCode {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
  const message = String(error.message ?? body.error ?? body.message ?? "").slice(0, 1000);
  if (status === 429 || (status === 403 && /quota\s+exceeded|rate\s+limit/i.test(message))) return "PROVIDER_QUOTA_EXCEEDED";
  if (status === 401 || status === 403) return "ROUTING_KEY_INVALID";
  return status >= 500 ? "ROUTING_UNAVAILABLE" : "ROUTE_NOT_FOUND";
}

export function canPlanRoadRouteRole(role: unknown) {
  return typeof role === "string" && ["owner", "traveler", "advisor", "editor"].includes(role);
}

export function canPlanRoadTrip(tripRole: TripMemberRole | null, agencyRole: "advisor" | "finance" | null, permissions?: AgencyPermissionMap) {
  const access = resolveEffectiveTripAccess(tripRole, agencyRole, permissions);
  return access?.agencyPermissions ? access.agencyPermissions.trips_plan : canPlanRoadRouteRole(access?.role);
}

export function roadModeForTransport(mode?: TransportMode): RoadTravelMode | undefined {
  if (mode === "bicycle" || mode === "walking") return mode;
  if (mode && ["car", "motorcycle", "camper", "taxi"].includes(mode)) return "car";
  return undefined;
}

/** Keep canonical adjacency: never connect selected points across an omitted
 * destination, a non-road stage or a different routing profile. */
export function roadRouteGroups(
  stops: Stop[],
  items: Pick<TravelItem, "id" | "type" | "details">[],
  selectedIds: string[] = stops.map(stop => stop.id),
  fallbackMode?: RoadTravelMode,
) {
  const selected = new Set(selectedIds), byId = new Map(items.map(item => [item.id, item]));
  const groups: RoadRouteGroup[] = [], skippedLegs: SkippedRoadLeg[] = [];
  let current: RoadRouteGroup | undefined;
  for (let index = 0; index < stops.length - 1; index++) {
    const from = stops[index]!, to = stops[index + 1]!;
    if (!selected.has(from.id) || !selected.has(to.id)) { current = undefined; continue; }
    const item = byId.get(`route-leg:${from.id}:${to.id}`);
    const mode = item?.details?.transportMode ?? (item?.type === "flight" ? "flight" : undefined);
    const roadMode = mode ? roadModeForTransport(mode) : fallbackMode;
    if (!roadMode) {
      skippedLegs.push({ fromStopId: from.id, toStopId: to.id, ...(mode ? { mode } : {}), reason: mode ? "non_road" : "unconfigured" });
      current = undefined;
      continue;
    }
    if (current?.mode === roadMode && current.stops.at(-1)?.id === from.id) current.stops.push(to);
    else { current = { stops: [from, to], mode: roadMode }; groups.push(current); }
  }
  return { groups, skippedLegs };
}

/** Preserve road-stage endpoints so optimisation cannot move a flight's
 * departure/arrival, ferry terminal or neighbouring profile boundary. */
export function lockRoadGroupEndpoints(base: RouteProposal): RouteProposal {
  if (base.original.length < 3) return base;
  const first = base.original[0]!, last = base.original.at(-1)!;
  const proposed = [first, ...base.proposed.filter(stop => stop.id !== first.id && stop.id !== last.id), last];
  return { ...base, proposed, changed: base.original.some((stop, index) => stop.id !== proposed[index]?.id) };
}

/** ORS removes the entire segments collection when instructions=false, even
 * for GeoJSON. Keep instructions enabled so each waypoint pair retains its
 * provider distance/duration; normalisation does not expose turn-by-turn steps. */
export function openRouteServiceBody(stops: Stop[], options: RoadRouteOptions) {
  const avoid = [options.avoidTolls && options.mode === "car" ? "tollways" : undefined, options.avoidFerries ? "ferries" : undefined].filter(Boolean);
  return {
    coordinates: stops.map((stop) => [stop.lon, stop.lat]),
    instructions: true,
    geometry: true,
    ...(avoid.length ? { options: { avoid_features: avoid } } : {}),
  };
}

export function routeBatches(stops: Stop[], maximumWaypoints = 40) {
  if (!Number.isInteger(maximumWaypoints) || maximumWaypoints < 2) throw new Error("ROUTE_BATCH_INVALID");
  const batches: Stop[][] = [];
  for (let start = 0; start < stops.length - 1; start += maximumWaypoints - 1) {
    const batch = stops.slice(start, Math.min(stops.length, start + maximumWaypoints));
    if (batch.length >= 2) batches.push(batch);
  }
  return batches;
}

export function mergeRoadRoutes(routes: RoadRoute[]): RoadRoute {
  return {
    distanceKm: Number(routes.reduce((sum, route) => sum + route.distanceKm, 0).toFixed(1)),
    durationMinutes: routes.reduce((sum, route) => sum + route.durationMinutes, 0),
    legs: routes.flatMap((route) => route.legs),
    segments: routes.flatMap((route) => route.segments ?? []),
  };
}

function metric(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
}

export function boundedRoadCoordinates(coordinates: [number, number][], maximum = 1024): [number, number][] {
  if (!Number.isInteger(maximum) || maximum < 2) throw new Error("ROUTE_GEOMETRY_LIMIT_INVALID");
  if (coordinates.length <= maximum) return coordinates;
  return Array.from({ length: maximum }, (_, index) => coordinates[Math.round(index * (coordinates.length - 1) / (maximum - 1))]!);
}

export function normalizeRoadRoute(payload: unknown, stops: Stop[], options?: RoadRouteOptions, calculatedAt = new Date().toISOString()): RoadRoute | undefined {
  const root = payload && typeof payload === "object" ? payload as Record<string, any> : {};
  const route = Array.isArray(root.routes)
    ? root.routes[0]
    : Array.isArray(root.features)
      ? root.features[0]?.properties
      : undefined;
  const summary = route?.summary;
  const totalDistance = metric(summary?.distance);
  const totalDuration = metric(summary?.duration);
  if (!Number.isFinite(totalDistance) || totalDistance < 0 || !Number.isFinite(totalDuration) || totalDuration < 0) return undefined;
  const segments = Array.isArray(route?.segments) ? route.segments : [];
  if (segments.length !== stops.length - 1 || segments.some((segment: any) => {
    const distance = metric(segment?.distance), duration = metric(segment?.duration);
    return !Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0;
  })) return undefined;
  const segmentDistance = segments.reduce((sum: number, segment: any) => sum + metric(segment.distance), 0);
  const segmentDuration = segments.reduce((sum: number, segment: any) => sum + metric(segment.duration), 0);
  if (Math.abs(totalDistance - segmentDistance) > Math.max(1, totalDistance / 1_000_000)
    || Math.abs(totalDuration - segmentDuration) > Math.max(1, totalDuration / 1_000_000)) return undefined;
  const legs = stops.slice(1).map((stop, index) => {
    const segment = segments[index];
    const distance = Number(segment.distance), duration = Number(segment.duration);
    return {
      from: stops[index]!.name,
      to: stop.name,
      fromStopId: stops[index]!.id,
      toStopId: stop.id,
      distanceKm: Number((distance / 1000).toFixed(1)),
      durationMinutes: Math.max(0, Math.round(duration / 60)),
    };
  });
  const result: RoadRoute = { distanceKm: Number((totalDistance / 1000).toFixed(1)), durationMinutes: Math.max(0, Math.round(totalDuration / 60)), legs };
  if (!options) return result;
  const geometry = root.features?.[0]?.geometry;
  const coordinates = geometry?.coordinates;
  const waypoints = route?.way_points;
  if (geometry?.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 500_000
    || coordinates.some((point: unknown) => !Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)
    || !Array.isArray(waypoints) || waypoints.length !== stops.length
    || waypoints[0] !== 0 || waypoints.at(-1) !== coordinates.length - 1
    || waypoints.some((point: unknown, index: number) => !Number.isInteger(point) || Number(point) < 0 || Number(point) >= coordinates.length || (index > 0 && Number(point) < waypoints[index - 1]))
    || waypoints.slice(1).some((point: number, index: number) => point === waypoints[index] && (metric(segments[index].distance) !== 0 || metric(segments[index].duration) !== 0))) return undefined;
  result.segments = stops.slice(1).map((stop, index) => {
    const from = stops[index]!, line = coordinates.slice(waypoints[index], waypoints[index + 1] + 1).map((point: number[]) => [point[0]!, point[1]!] as [number, number]);
    if (line.length === 1) line.push(line[0]!);
    return { source: "openrouteservice", mode: options.mode, fromStopId: from.id, toStopId: stop.id,
      from: [from.lon, from.lat], to: [stop.lon, stop.lat], coordinates: boundedRoadCoordinates(line),
      distanceKm: legs[index]!.distanceKm, durationMinutes: legs[index]!.durationMinutes,
      calculatedAt, avoidTolls: options.avoidTolls, avoidFerries: options.avoidFerries };
  });
  return result;
}

export function roadProposal(base: RouteProposal, original: RoadRoute, proposed: RoadRoute, options: RoadRouteOptions, providerRequestCount = 2, skippedLegs: SkippedRoadLeg[] = []): RoadRouteProposal {
  const savedDistanceKm = Math.max(0, Number((original.distanceKm - proposed.distanceKm).toFixed(1)));
  const savedDurationMinutes = Math.max(0, original.durationMinutes - proposed.durationMinutes);
  const changed = base.original.some((stop, index) => stop.id !== base.proposed[index]?.id)
    && (proposed.distanceKm < original.distanceKm || proposed.durationMinutes < original.durationMinutes);
  return {
    ...base,
    proposed: changed ? base.proposed : base.original,
    originalLegs: original.legs,
    proposedLegs: changed ? proposed.legs : original.legs,
    originalDistanceKm: original.distanceKm,
    proposedDistanceKm: changed ? proposed.distanceKm : original.distanceKm,
    savedDistanceKm: changed ? savedDistanceKm : 0,
    savedDurationMinutes: changed ? savedDurationMinutes : 0,
    changed,
    source: "openrouteservice",
    mode: options.mode,
    avoidTolls: options.avoidTolls,
    avoidFerries: options.avoidFerries,
    restStops: buildRestStops(changed ? base.proposed : base.original, changed ? proposed.legs : original.legs, options.restEveryMinutes),
    providerRequestCount,
    originalRoadSegments: original.segments ?? [],
    proposedRoadSegments: (changed ? proposed : original).segments ?? [],
    skippedLegs,
  };
}

export function buildRestStops(stops: Stop[], legs: RoadRouteLeg[], interval: number): RestStopSuggestion[] {
  if (!Number.isFinite(interval) || interval < 60) return [];
  const suggestions: RestStopSuggestion[] = [];
  legs.forEach((leg, index) => {
    for (let elapsed = interval; elapsed < leg.durationMinutes; elapsed += interval) {
      const afterStopId = leg.fromStopId ?? stops[index]?.id, beforeStopId = leg.toStopId ?? stops[index + 1]?.id;
      if (afterStopId && beforeStopId) suggestions.push({ afterStopId, beforeStopId, afterMinutes: elapsed, label: `${leg.from} → ${leg.to}` });
    }
  });
  return suggestions.slice(0, 20);
}
