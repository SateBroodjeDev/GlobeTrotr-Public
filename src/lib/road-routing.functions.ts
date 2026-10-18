import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeProviderQuota } from "@/lib/provider-quota.server";
import { effectiveAgencyPermissions, type AgencyPermissionMap } from "@/lib/agency-permissions";
import { proposeRouteOrder } from "@/lib/route-optimizer";
import { mapTripRouteLegs, routeLegId } from "@/lib/route-map";
import {
  isRoadRouteStopId, lockRoadGroupEndpoints, mergeRoadRoutes, normalizeRoadRoute,
  openRouteServiceBody, roadProposal, roadRouteGroups, roadRoutingEndpoint, roadRoutingProviderErrorCode,
  routeBatches, canPlanRoadTrip, roadModeForTransport, type RoadRoute, type RoadRouteOptions,
  type RoadTravelMode, type TripRoadRoutes,
} from "@/lib/road-routing";
import type { PlanId, Stop, TravelItem, TripMemberRole } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = new Set<RoadTravelMode>(["car", "bicycle", "walking"]);
type RoutingInput = { tripId: string; stopIds: string[]; mode: RoadTravelMode; avoidTolls: boolean; avoidFerries: boolean; restEveryMinutes: number };

async function loadRoadTrip(db: any, userId: string, tripId: string) {
  const { data: trip, error } = await db.from("trips").select("workspace_user_id,workspace_uuid,start_date").eq("trip_uuid", tripId).maybeSingle();
  if (error || !trip) throw new Error("TRIP_NOT_FOUND");
  const workspaceResult = await db.from("workspaces").select("plan").eq("workspace_uuid", trip.workspace_uuid).maybeSingle();
  if (workspaceResult.error || !workspaceResult.data) throw new Error("WORKSPACE_NOT_FOUND");
  if (trip.workspace_user_id !== userId) {
    const { data: member, error: memberError } = await db.from("trip_members")
      .select("role").eq("trip_uuid", tripId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (memberError) throw new Error("TRIP_ACCESS_UNAVAILABLE");
    let agencyRole: "advisor" | "finance" | null = null, permissions: AgencyPermissionMap | undefined;
    if (workspaceResult.data.plan === "agency") {
      const { data: agencyMember, error: agencyError } = await db.from("workspace_members")
        .select("role,permission_overrides").eq("workspace_uuid", trip.workspace_uuid).eq("user_id", userId)
        .eq("status", "active").in("role", ["advisor", "finance"]).maybeSingle();
      if (agencyError) throw new Error("TRIP_ACCESS_UNAVAILABLE");
      if (agencyMember) {
        agencyRole = agencyMember.role;
        const { data: defaults, error: defaultsError } = await db.from("agency_role_permissions")
          .select("permissions").eq("workspace_uuid", trip.workspace_uuid).eq("role", agencyRole).maybeSingle();
        if (defaultsError) throw new Error("TRIP_ACCESS_UNAVAILABLE");
        permissions = effectiveAgencyPermissions(agencyMember.role, defaults?.permissions, agencyMember.permission_overrides);
      }
    }
    if (!canPlanRoadTrip((member?.role as TripMemberRole | undefined) ?? null, agencyRole, permissions)) throw new Error("TRIP_PLANNER_REQUIRED");
  }
  const [stopsResult, itemsResult] = await Promise.all([
    db.from("trip_stops").select("id,name,country,lat,lon,arrive_date,nights,position").eq("trip_uuid", tripId).order("position"),
    db.from("trip_travel_items").select("id,item_type,title,start_date,end_date,departure,arrival,details").eq("trip_uuid", tripId),
  ]);
  if (stopsResult.error || itemsResult.error) throw new Error("ROUTE_STOPS_UNAVAILABLE");
  const coordinate = (value: unknown) => typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  const stops: Stop[] = (stopsResult.data ?? []).map((row: any) => ({
    id: String(row.id), name: String(row.name), country: String(row.country ?? ""),
    lat: coordinate(row.lat), lon: coordinate(row.lon), arrive: row.arrive_date ?? undefined, nights: row.nights ?? undefined,
  }));
  if (stops.some(stop => !Number.isFinite(stop.lat) || !Number.isFinite(stop.lon) || Math.abs(stop.lat) > 90 || Math.abs(stop.lon) > 180)) throw new Error("ROUTE_STOPS_INVALID");
  const items: TravelItem[] = (itemsResult.data ?? []).map((row: any) => ({
    id: String(row.id), type: row.item_type, title: String(row.title), date: row.start_date, endDate: row.end_date ?? undefined,
    departure: row.departure ?? undefined, arrival: row.arrival ?? undefined,
    details: row.details && typeof row.details === "object" ? row.details : undefined,
  }));
  return { stops, items, start: trip.start_date as string, workspaceId: String(trip.workspace_uuid), plan: String(workspaceResult.data.plan ?? "free") as PlanId };
}

function roadRequester(db: any, actorId: string, workspaceId: string, plan: PlanId) {
  const key = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!key) throw new Error("ROUTING_NOT_CONFIGURED");
  let providerRequestCount = 0;
  const requestBatch = async (stops: Stop[], options: RoadRouteOptions) => {
    // Each upstream request uses one quota unit, including optimisation
    // comparisons and overlapping batches of a large road stage.
    await consumeProviderQuota(db, workspaceId, actorId, plan, "routing");
    providerRequestCount++;
    let response: Response;
    try {
      response = await fetch(roadRoutingEndpoint(options.mode), {
        method: "POST", headers: { Authorization: key, Accept: "application/geo+json, application/json", "Content-Type": "application/json" },
        body: JSON.stringify(openRouteServiceBody(stops, options)), signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new Error("ROUTING_TIMEOUT");
      throw new Error("ROUTING_UNAVAILABLE");
    }
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new Error(roadRoutingProviderErrorCode(response.status, failure));
    }
    const payload = await response.json().catch(() => null);
    const normalized = normalizeRoadRoute(payload, stops, options);
    if (!normalized) {
      const providerCode = payload && typeof payload === "object" ? payload.error?.code ?? payload.code : undefined;
      console.error("[Road routing] Invalid provider response", {
        providerCode: typeof providerCode === "number" || typeof providerCode === "string" ? String(providerCode).slice(0, 80) : undefined,
        hasFeatures: Array.isArray(payload?.features), stopCount: stops.length,
      });
      throw new Error("ROUTING_RESPONSE_INVALID");
    }
    return normalized;
  };
  return {
    count: () => providerRequestCount,
    request: async (stops: Stop[], options: RoadRouteOptions) => {
      const routes: RoadRoute[] = [];
      // Sequential requests respect the provider's short-window limits.
      for (const batch of routeBatches(stops)) routes.push(await requestBatch(batch, options));
      return mergeRoadRoutes(routes);
    },
  };
}

export const calculateTripRoadRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }): Promise<TripRoadRoutes> => {
    if (!UUID.test(data.tripId)) throw new Error("INVALID_ROUTE_REQUEST");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const trip = await loadRoadTrip(db, context.userId, data.tripId);
    const legs = mapTripRouteLegs({ ...trip, travelItems: trip.items });
    if (!legs.length || legs.length > 300) throw new Error("ROUTE_STOPS_INVALID");
    const groups: Array<{ stops: Stop[]; mode: RoadTravelMode }> = [];
    const skippedLegs: TripRoadRoutes["skippedLegs"] = [];
    let activeGroup: (typeof groups)[number] | undefined;
    for (const leg of legs) {
      const mode = roadModeForTransport(leg.mode);
      if (!mode) { activeGroup = undefined; skippedLegs.push({ fromStopId: leg.from.id, toStopId: leg.to.id, ...(leg.mode ? { mode: leg.mode } : {}), reason: leg.mode ? "non_road" : "unconfigured" }); continue; }
      if (activeGroup?.mode === mode && activeGroup.stops.at(-1)?.id === leg.from.id) activeGroup.stops.push(leg.to);
      else { activeGroup = { stops: [leg.from, leg.to], mode }; groups.push(activeGroup); }
    }
    if (!groups.length) throw new Error("NO_ROAD_SEGMENTS");
    const provider = roadRequester(db, context.userId, trip.workspaceId, trip.plan);
    const routes: RoadRoute[] = [];
    for (const group of groups) routes.push(await provider.request(group.stops, { mode: group.mode, avoidTolls: false, avoidFerries: false, restEveryMinutes: 0 }));
    return { segments: mergeRoadRoutes(routes).segments ?? [], skippedLegs, providerRequestCount: provider.count() };
  });

export const calculateRoadRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: RoutingInput) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.tripId) || !Array.isArray(data.stopIds) || data.stopIds.length < 2 || data.stopIds.length > 200
      || new Set(data.stopIds).size !== data.stopIds.length || data.stopIds.some(id => !isRoadRouteStopId(id)) || !modes.has(data.mode)
      || typeof data.avoidTolls !== "boolean" || typeof data.avoidFerries !== "boolean" || ![0, 90, 120, 150, 180].includes(data.restEveryMinutes)) throw new Error("INVALID_ROUTE_REQUEST");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any, trip = await loadRoadTrip(db, context.userId, data.tripId);
    const selected = new Set(data.stopIds), stops = trip.stops.filter(stop => selected.has(stop.id));
    if (stops.length !== data.stopIds.length) throw new Error("ROUTE_STOPS_INVALID");
    const graph = mapTripRouteLegs({ ...trip, travelItems: trip.items });
    const graphItems: TravelItem[] = trip.stops.slice(0, -1).map((from, index) => {
      const to = trip.stops[index + 1]!;
      const leg = graph.find(edge => edge.from.id === from.id && edge.to.id === to.id);
      return { id: routeLegId(from.id, to.id), title: "", date: trip.start, type: "transport", details: { transportMode: leg ? leg.mode : "other", routePlanningOnly: true } };
    });
    const { groups, skippedLegs } = roadRouteGroups(trip.stops, graphItems, data.stopIds, data.mode);
    if (!groups.length) throw new Error("NO_ROAD_SEGMENTS");
    const options: RoadRouteOptions = { mode: data.mode, avoidTolls: data.avoidTolls, avoidFerries: data.avoidFerries, restEveryMinutes: data.restEveryMinutes };
    const provider = roadRequester(db, context.userId, trip.workspaceId, trip.plan);
    const originals: RoadRoute[] = [], proposals: RoadRoute[] = [], replacement = new Map<string, Stop>();
    for (const group of groups) {
      const groupOptions = { ...options, mode: group.mode }, base = lockRoadGroupEndpoints(proposeRouteOrder(group.stops));
      const original = await provider.request(base.original, groupOptions);
      const proposed = base.changed ? await provider.request(base.proposed, groupOptions) : original;
      const candidate = roadProposal(base, original, proposed, groupOptions, provider.count());
      originals.push(original);
      proposals.push(candidate.changed ? proposed : original);
      if (candidate.changed) base.original.forEach((stop, index) => replacement.set(stop.id, candidate.proposed[index]!));
    }
    const base = { ...proposeRouteOrder(stops), proposed: stops.map(stop => replacement.get(stop.id) ?? stop) };
    return roadProposal(base, mergeRoadRoutes(originals), mergeRoadRoutes(proposals), options, provider.count(), skippedLegs);
  });
