import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Trip, TripMemberRole, WorkspaceState } from "@/lib/types";
import { protectTripUpdate } from "@/lib/trip-access";
import {
  effectiveAgencyPermissions,
  protectAgencyTripUpdate,
  resolveEffectiveTripAccess,
  type AgencyPermissionMap,
} from "@/lib/agency-permissions";
import { TRIP_DESCRIPTION_MAX_LENGTH, TRIP_NAME_MAX_LENGTH } from "@/lib/trip-limits";
import { resolveBranding } from "@/lib/branding";
import { recordTripManagementAudit } from "@/lib/trip-management-access.server";
import { normalizeTravelOption } from "@/lib/trip-options";

type UntypedSupabase = {
  from: (relation: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};
type StoredTrip = { id: string; trip_uuid: string };

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Keep invalid trip settings out of both relational storage and the JSON backup. */
function normalizeTripForPersistence(trip: Trip): Trip {
  const name = trip.name.trim();
  const description = trip.description?.trim();
  if (!name) throw new Error("Een reisnaam is verplicht.");
  if (name.length > TRIP_NAME_MAX_LENGTH) {
    throw new Error(`De reisnaam mag maximaal ${TRIP_NAME_MAX_LENGTH} tekens bevatten.`);
  }
  if (description && description.length > TRIP_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `De reisomschrijving mag maximaal ${TRIP_DESCRIPTION_MAX_LENGTH} tekens bevatten.`,
    );
  }
  if (!isIsoDate(trip.start) || !isIsoDate(trip.end)) {
    throw new Error("Vul een geldige start- en einddatum in.");
  }
  if (trip.end < trip.start) throw new Error("De einddatum kan niet vóór de startdatum liggen.");
  if (!Number.isFinite(trip.budget) || trip.budget < 0) {
    throw new Error("Het budget moet een bedrag van nul of hoger zijn.");
  }
  const { accessRole: _accessRole, ownerId: _ownerId, ...persistentTrip } = trip;
  if ((trip.travelOptions?.length ?? 0) > 100)
    throw new Error("Een reis kan maximaal 100 opties bevatten.");
  const travelOptions = (trip.travelOptions ?? []).map((option) => {
    if (!option.id || !option.title.trim()) throw new Error("Een reisoptie heeft een naam nodig.");
    if (!["flight", "lodging", "transport", "car_rental", "activity"].includes(option.type)) {
      throw new Error("Een reisoptie bevat een ongeldig type.");
    }
    if (!["candidate", "selected", "rejected"].includes(option.status)) {
      throw new Error("Een reisoptie bevat een ongeldige status.");
    }
    if (!isIsoDate(option.startDate) || (option.endDate && !isIsoDate(option.endDate))) {
      throw new Error("Een reisoptie bevat een ongeldige datum.");
    }
    if (option.endDate && option.endDate < option.startDate) {
      throw new Error("De einddatum van een reisoptie kan niet vóór de startdatum liggen.");
    }
    const createdAt = new Date(option.createdAt);
    if (Number.isNaN(createdAt.getTime()))
      throw new Error("Een reisoptie bevat een ongeldige aanmaakdatum.");
    return normalizeTravelOption({ ...option, createdAt: createdAt.toISOString() });
  });
  return { ...persistentTrip, name, description, travelOptions };
}

async function withinTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Relationele reissync duurde te lang.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Transitional write-through while workspace.data is still used by the UI.
 * The UUID migration is optional here: users can deploy this code before
 * running it without losing their JSON workspace.
 */
async function syncTripsFromWorkspaceJson(
  client: UntypedSupabase,
  userId: string,
  workspace: WorkspaceState,
) {
  const { data: stored, error: storedError } = await client
    .from("trips")
    .select("id, trip_uuid")
    .eq("workspace_user_id", userId);
  if (storedError) throw storedError;

  const storedTrips = (stored ?? []) as StoredTrip[];
  const storedByLegacyId = new Map(storedTrips.map((trip) => [trip.id, trip]));
  const storedByUuid = new Map(storedTrips.map((trip) => [trip.trip_uuid, trip]));
  const persistedLegacyIds = new Set<string>();
  for (const trip of workspace.trips) {
    const existing = storedByLegacyId.get(trip.id) ?? storedByUuid.get(trip.id);
    const legacyId = existing?.id ?? trip.id;
    const { data: savedTrip, error: tripError } = await client
      .from("trips")
      .upsert(
        {
          workspace_user_id: userId,
          id: legacyId,
          name: trip.name,
          description: trip.description ?? null,
          template: trip.template,
          start_date: trip.start || null,
          end_date: trip.end || null,
          budget: trip.budget,
          travelers: trip.travelers ?? [],
          archived: trip.archived ?? false,
          is_public: trip.public ?? false,
          share_financials: trip.shareFinancials ?? false,
          share_pin_hash: trip.sharePinHash ?? null,
        },
        { onConflict: "workspace_user_id,id" },
      )
      .select("id, trip_uuid")
      .single();
    if (tripError) throw tripError;
    const saved = savedTrip as StoredTrip;
    persistedLegacyIds.add(saved.id);
    await replaceTripChildren(client, userId, trip, saved.id, saved.trip_uuid);
  }

  for (const savedTrip of storedTrips) {
    if (!persistedLegacyIds.has(savedTrip.id)) {
      const { error } = await client
        .from("trips")
        .delete()
        .eq("workspace_user_id", userId)
        .eq("trip_uuid", savedTrip.trip_uuid);
      if (error) throw error;
    }
  }
}

async function replaceTripChildren(
  client: UntypedSupabase,
  userId: string,
  trip: Trip,
  legacyTripId: string,
  tripUuid: string,
) {
  const scope = { workspace_user_id: userId, trip_id: legacyTripId, trip_uuid: tripUuid };
  const replace = async (table: string, rows: Record<string, unknown>[]) => {
    const { error: deleteError } = await client.from(table).delete().eq("trip_uuid", tripUuid);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error: insertError } = await client.from(table).insert(rows);
    if (insertError) throw insertError;
  };

  await replace(
    "trip_stops",
    trip.stops.map(({ arrive, ...stop }, position) => ({
      ...scope,
      ...stop,
      position,
      arrive_date: arrive ?? null,
    })),
  );
  await replace(
    "trip_itinerary_items",
    trip.itinerary.map((item, position) => ({
      ...scope,
      id: item.id,
      day: item.day,
      title: item.title,
      notes: item.notes ?? null,
      source_travel_item_id: item.sourceTravelItemId ?? null,
      position,
    })),
  );
  await replace(
    "trip_expenses",
    trip.expenses.map((expense) => ({
      ...scope,
      id: expense.id,
      expense_date: expense.date,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      paid_by: expense.paidBy,
      billable: expense.billable,
      split_with: expense.splitWith ?? [],
      receipt_path: expense.receiptPath ?? null,
      receipt_name: expense.receiptName ?? null,
      notes: expense.notes ?? null,
    })),
  );
  await replace(
    "trip_travel_items",
    (trip.travelItems ?? []).map((item) => ({
      ...scope,
      id: item.id,
      item_type: item.type,
      title: item.title,
      start_date: item.date,
      end_date: item.endDate ?? null,
      provider: item.provider ?? null,
      booking_reference: item.bookingReference ?? null,
      flight_number: item.flightNumber ?? null,
      flight_status: item.flightStatus ?? null,
      departure: item.departure ?? null,
      arrival: item.arrival ?? null,
      location: item.location ?? null,
      amount: item.amount ?? null,
      currency: item.currency ?? null,
      expense_id: item.expenseId ?? null,
      notes: item.notes ?? null,
      details: item.details ?? {},
    })),
  );
  await replace(
    "trip_travel_options",
    (trip.travelOptions ?? []).map((option) => ({
      ...scope,
      id: option.id,
      option_type: option.type,
      title: option.title,
      start_date: option.startDate,
      end_date: option.endDate ?? null,
      provider: option.provider ?? null,
      amount: option.amount ?? null,
      currency: option.currency ?? null,
      charges_included: option.chargesIncluded ?? false,
      cancellation: option.cancellation ?? null,
      duration_minutes: option.durationMinutes ?? null,
      distance_km: option.distanceKm ?? null,
      source_url: option.sourceUrl ?? null,
      notes: option.notes ?? null,
      details: option.details ?? {},
      status: option.status,
      checked_at: option.checkedAt ?? null,
      converted_travel_item_id: option.convertedTravelItemId ?? null,
      created_at: option.createdAt,
    })),
  );
  await replace(
    "trip_packing_items",
    (trip.packing ?? []).map((item, position) => ({ ...scope, ...item, position })),
  );

  // De eigenaar wordt door de database-trigger beheerd en mag niet uit de
  // JSON-snapshot verdwijnen. De overige reisgenoten komen uit Instellingen.
  const { error: deleteMembersError } = await client
    .from("trip_members")
    .delete()
    .eq("trip_uuid", tripUuid)
    .neq("role", "owner");
  if (deleteMembersError) throw deleteMembersError;
  const members = (trip.members ?? []).map((member) => ({
    ...scope,
    id: member.id,
    user_id: null,
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    invited_at: member.invitedAt,
    accepted_at: null,
  }));
  if (members.length) {
    const { error: memberError } = await client.from("trip_members").insert(members);
    if (memberError) throw memberError;
  }
}

async function saveRelationalTrip(client: UntypedSupabase, userId: string, trip: Trip) {
  const { data: existingByUuid } = await client
    .from("trips")
    .select("id, trip_uuid")
    .eq("workspace_user_id", userId)
    .eq("trip_uuid", trip.id)
    .maybeSingle();
  const legacyId = (existingByUuid as StoredTrip | null)?.id ?? trip.id;
  const { data: savedTrip, error } = await client
    .from("trips")
    .upsert(
      {
        workspace_user_id: userId,
        id: legacyId,
        trip_uuid: trip.id,
        name: trip.name,
        description: trip.description ?? null,
        template: trip.template,
        start_date: trip.start || null,
        end_date: trip.end || null,
        budget: trip.budget,
        travelers: trip.travelers ?? [],
        archived: trip.archived ?? false,
        is_public: trip.public ?? false,
        share_financials: trip.shareFinancials ?? false,
        share_pin_hash: trip.sharePinHash ?? null,
      },
      { onConflict: "workspace_user_id,id" },
    )
    .select("id, trip_uuid")
    .single();
  if (error) throw error;
  const saved = savedTrip as StoredTrip;
  await replaceTripChildren(client, userId, trip, saved.id, saved.trip_uuid);
  return saved;
}

async function updateTripJsonBackup(
  client: UntypedSupabase,
  userId: string,
  trip: Trip,
  legacyTripId: string,
) {
  const { data: workspace, error } = await client
    .from("workspaces")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const current = (workspace?.data ?? {}) as Partial<WorkspaceState>;
  const trips = Array.isArray(current.trips) ? current.trips : [];
  const normalized = { ...trip, id: trip.id };
  const exists = trips.some((item) => item.id === trip.id || item.id === legacyTripId);
  const data = {
    ...current,
    trips: exists
      ? trips.map((item) => (item.id === trip.id || item.id === legacyTripId ? normalized : item))
      : [...trips, normalized],
  };
  const { error: updateError } = await client
    .from("workspaces")
    .upsert({ user_id: userId, data }, { onConflict: "user_id" });
  if (updateError) throw updateError;
}

function withDatabaseTripIds(data: unknown, rows: StoredTrip[]): unknown {
  if (!data || typeof data !== "object") return data;
  const workspace = data as WorkspaceState;
  if (!Array.isArray(workspace.trips)) return data;
  const byLegacyId = new Map(rows.map((trip) => [trip.id, trip.trip_uuid]));
  return {
    ...workspace,
    trips: workspace.trips.map((trip) => ({
      ...trip,
      // Oude JSON-data bewaart de tijdelijke tekst-ID. De app gebruikt vanaf
      // hier de database-UUID voor private routes en alle nieuwe writes.
      id: byLegacyId.get(trip.id) ?? trip.id,
    })),
  } satisfies WorkspaceState;
}

async function loadRelationalTrips(client: UntypedSupabase, userId: string): Promise<Trip[]> {
  const parentColumns =
    "trip_uuid, workspace_user_id, revision::text, name, description, template, start_date, end_date, budget, travelers, archived, is_public, share_financials, share_pin_hash";
  const [{ data: ownedParents, error: ownedError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      client
        .from("trips")
        .select(parentColumns)
        .eq("workspace_user_id", userId)
        .order("start_date", { ascending: true }),
      client
        .from("trip_members")
        .select("trip_uuid, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .neq("role", "owner"),
    ]);
  if (ownedError) throw ownedError;
  if (membershipError) throw membershipError;
  const membershipRows = (memberships ?? []) as { trip_uuid: string; role: TripMemberRole }[];
  const sharedIds = membershipRows.map((membership) => membership.trip_uuid);
  const { data: sharedParents, error: sharedError } = sharedIds.length
    ? await client
        .from("trips")
        .select(parentColumns)
        .in("trip_uuid", sharedIds)
        .order("start_date", { ascending: true })
    : { data: [], error: null };
  if (sharedError) throw sharedError;
  const accessByTrip = new Map<string, TripMemberRole>(
    membershipRows.map((membership) => [String(membership.trip_uuid), membership.role]),
  );
  // Interne Agency-leden ontlenen toegang aan de workspace. Deze optionele
  // stap blijft compatibel totdat de relationele Agency-migratie is uitgevoerd.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const agencyClient = supabaseAdmin as unknown as UntypedSupabase;
  const { data: agencyMemberships, error: agencyMembershipError } = await agencyClient
    .from("workspace_members")
    .select("workspace_uuid, role, permission_overrides")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("role", "owner");
  let agencyParents: Record<string, any>[] = [];
  if (!agencyMembershipError && agencyMemberships?.length) {
    const candidateWorkspaceIds = agencyMemberships.map(
      (membership: any) => membership.workspace_uuid,
    );
    const { data: permissionRows } = await agencyClient
      .from("agency_role_permissions")
      .select("workspace_uuid, role, permissions")
      .in("workspace_uuid", candidateWorkspaceIds);
    const defaultsByRole = new Map(
      (permissionRows ?? []).map((row: any) => [
        `${row.workspace_uuid}:${row.role}`,
        row.permissions,
      ]),
    );
    const visibleMemberships = agencyMemberships.filter(
      (membership: any) =>
        effectiveAgencyPermissions(
          membership.role,
          defaultsByRole.get(`${membership.workspace_uuid}:${membership.role}`) as
            Partial<AgencyPermissionMap> | undefined,
          membership.permission_overrides as Partial<AgencyPermissionMap> | null,
        ).trips_view,
    );
    const workspaceIds = visibleMemberships.map((membership: any) => membership.workspace_uuid);
    const roleByWorkspace = new Map<string, TripMemberRole>(
      visibleMemberships.map((membership: any) => [
        String(membership.workspace_uuid),
        membership.role === "finance" ? "finance" : "advisor",
      ]),
    );
    const { data: rows, error: agencyError } = await client
      .from("trips")
      .select(`${parentColumns}, workspace_uuid`)
      .in("workspace_uuid", workspaceIds)
      .order("start_date", { ascending: true });
    if (agencyError) throw agencyError;
    agencyParents = (rows ?? []) as Record<string, any>[];
    for (const row of agencyParents) {
      const role = roleByWorkspace.get(String(row.workspace_uuid));
      if (role) accessByTrip.set(String(row.trip_uuid), role);
    }
  }
  const rows = [
    ...((ownedParents ?? []) as Record<string, any>[]),
    ...((sharedParents ?? []) as Record<string, any>[]),
    ...agencyParents,
  ].filter(
    (row, index, all) =>
      all.findIndex((candidate) => candidate.trip_uuid === row.trip_uuid) === index,
  );
  const ids = rows.map((row) => String(row.trip_uuid));
  if (!ids.length) return [];
  // RLS bepaalt eerst welke reizen dit account mag zien. Pas daarna vult de
  // server leden aan; alleen de eigenaar ontvangt hieronder e-mailadressen.
  const memberClient = supabaseAdmin as unknown as UntypedSupabase;
  const [stops, itinerary, expenses, travelItems, travelOptions, packing, members] =
    await Promise.all([
      client.from("trip_stops").select("*").in("trip_uuid", ids).order("position"),
      client.from("trip_itinerary_items").select("*").in("trip_uuid", ids).order("position"),
      client.from("trip_expenses").select("*").in("trip_uuid", ids),
      client.from("trip_travel_items").select("*").in("trip_uuid", ids),
      client.from("trip_travel_options").select("*").in("trip_uuid", ids).order("created_at"),
      client.from("trip_packing_items").select("*").in("trip_uuid", ids).order("position"),
      memberClient.from("trip_members").select("*").in("trip_uuid", ids),
    ]);
  const childError = [
    stops,
    itinerary,
    expenses,
    travelItems,
    travelOptions,
    packing,
    members,
  ].find((result) => result.error)?.error;
  if (childError) throw childError;
  const grouped = (result: { data?: unknown }, key = "trip_uuid") => {
    const map = new Map<string, Record<string, any>[]>();
    for (const row of (result.data ?? []) as Record<string, any>[]) {
      const id = String(row[key]);
      map.set(id, [...(map.get(id) ?? []), row]);
    }
    return map;
  };
  const stopsByTrip = grouped(stops);
  const itineraryByTrip = grouped(itinerary);
  const expensesByTrip = grouped(expenses);
  const travelByTrip = grouped(travelItems);
  const optionsByTrip = grouped(travelOptions);
  const packingByTrip = grouped(packing);
  const membersByTrip = grouped(members);
  const { data: brandingRows } = await memberClient
    .from("trip_branding_overrides")
    .select("trip_uuid, enabled, brand_name, domain, tagline, accent")
    .in("trip_uuid", ids);
  const brandingByTrip = new Map(
    ((brandingRows ?? []) as Record<string, any>[])
      .filter((branding) => branding.enabled)
      .map((branding) => [
        String(branding.trip_uuid),
        {
          ...(branding.brand_name ? { brandName: String(branding.brand_name) } : {}),
          ...(branding.domain ? { domain: String(branding.domain) } : {}),
          ...(branding.tagline ? { tagline: String(branding.tagline) } : {}),
          ...(branding.accent == null ? {} : { accent: Number(branding.accent) }),
        },
      ]),
  );
  return rows.map((row) => {
    const id = String(row.trip_uuid);
    const accessRole = accessByTrip.get(id) ?? "owner";
    const maySeeMoney = ["owner", "traveler", "advisor", "finance"].includes(accessRole);
    return {
      id,
      ownerId: String(row.workspace_user_id),
      accessRole,
      ...(row["revision"] == null ? {} : { revision: String(row["revision"]) }),
      name: String(row.name ?? "Reis"),
      ...(row.description ? { description: String(row.description) } : {}),
      ...(brandingByTrip.has(id) ? { branding: brandingByTrip.get(id) } : {}),
      template: row.template,
      start: row.start_date ?? "",
      end: row.end_date ?? "",
      budget: Number(row.budget ?? 0),
      travelers: Array.isArray(row.travelers) ? row.travelers : [],
      archived: Boolean(row.archived),
      public: Boolean(row.is_public),
      shareFinancials: Boolean(row.share_financials),
      ...(row.share_pin_hash ? { sharePinHash: String(row.share_pin_hash) } : {}),
      stops: (stopsByTrip.get(id) ?? []).map((stop) => ({
        id: String(stop.id),
        name: String(stop.name),
        country: String(stop.country ?? ""),
        lat: Number(stop.lat),
        lon: Number(stop.lon),
        arrive: stop.arrive_date ?? undefined,
        nights: stop.nights ?? undefined,
      })),
      itinerary: (itineraryByTrip.get(id) ?? []).map((item) => ({
        id: String(item.id),
        day: String(item.day),
        title: String(item.title),
        notes: item.notes ?? undefined,
        sourceTravelItemId: item.source_travel_item_id ?? undefined,
      })),
      expenses: (maySeeMoney ? (expensesByTrip.get(id) ?? []) : []).map((expense) => ({
        id: String(expense.id),
        date: String(expense.expense_date),
        title: String(expense.title),
        category: expense.category,
        amount: Number(expense.amount),
        currency: String(expense.currency),
        paidBy: String(expense.paid_by),
        billable: Boolean(expense.billable),
        splitWith: Array.isArray(expense.split_with) ? expense.split_with : [],
        receiptPath: expense.receipt_path ?? undefined,
        receiptName: expense.receipt_name ?? undefined,
        notes: expense.notes ?? undefined,
      })),
      travelItems: (travelByTrip.get(id) ?? []).map((item) => ({
        id: String(item.id),
        type: item.item_type,
        title: String(item.title),
        date: String(item.start_date),
        endDate: item.end_date ?? undefined,
        provider: item.provider ?? undefined,
        bookingReference: item.booking_reference ?? undefined,
        flightNumber: item.flight_number ?? undefined,
        flightStatus: item.flight_status ?? undefined,
        departure: item.departure ?? undefined,
        arrival: item.arrival ?? undefined,
        location: item.location ?? undefined,
        amount: item.amount === null ? undefined : Number(item.amount),
        currency: item.currency ?? undefined,
        expenseId: item.expense_id ?? undefined,
        notes: item.notes ?? undefined,
        details: item.details ?? undefined,
      })),
      travelOptions: (optionsByTrip.get(id) ?? []).map((option) => ({
        id: String(option.id),
        type: option.option_type,
        title: String(option.title),
        startDate: String(option.start_date),
        endDate: option.end_date ?? undefined,
        provider: option.provider ?? undefined,
        amount: option.amount === null ? undefined : Number(option.amount),
        currency: option.currency ?? undefined,
        chargesIncluded: Boolean(option.charges_included),
        cancellation: option.cancellation ?? undefined,
        durationMinutes:
          option.duration_minutes == null ? undefined : Number(option.duration_minutes),
        distanceKm: option.distance_km == null ? undefined : Number(option.distance_km),
        sourceUrl: option.source_url ?? undefined,
        notes: option.notes ?? undefined,
        details: option.details && typeof option.details === "object" ? option.details : undefined,
        status: option.status,
        checkedAt: option.checked_at ?? undefined,
        convertedTravelItemId: option.converted_travel_item_id ?? undefined,
        createdAt: String(option.created_at),
      })),
      packing: (packingByTrip.get(id) ?? []).map((item) => ({
        id: String(item.id),
        label: String(item.label),
        done: Boolean(item.done),
      })),
      members: (membersByTrip.get(id) ?? [])
        .filter((member) => member.role !== "owner")
        .map((member) => ({
          id: String(member.id),
          name: String(member.name),
          email: accessRole === "owner" && member.email ? String(member.email) : "",
          role: member.role,
          status: member.status,
          invitedAt: String(member.invited_at),
        })),
    } as Trip;
  });
}

export const loadWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: personalWorkspace, error } = await supabase
      .from("workspaces")
      .select("data, public_token, share_enabled, share_financials, plan, base_currency, branding")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!personalWorkspace) return null;
    try {
      const db = supabase as unknown as UntypedSupabase;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as unknown as UntypedSupabase;
      const { data: agencyMembership } = await admin
        .from("workspace_members")
        .select("workspace_uuid, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .neq("role", "owner")
        .limit(1)
        .maybeSingle();
      let data = personalWorkspace as Record<string, any>;
      let workspaceRole: "editor" | "accountant" | undefined;
      if (agencyMembership) {
        const { data: agencyWorkspace } = await admin
          .from("workspaces")
          .select(
            "data, public_token, share_enabled, share_financials, plan, base_currency, branding",
          )
          .eq("workspace_uuid", agencyMembership.workspace_uuid)
          .eq("plan", "agency")
          .maybeSingle();
        if (agencyWorkspace) {
          data = agencyWorkspace as Record<string, any>;
          workspaceRole = agencyMembership.role === "finance" ? "accountant" : "editor";
        }
      }
      const relationalTrips = await loadRelationalTrips(db, userId);
      const jsonWorkspace = data.data as WorkspaceState;
      let agencyBranding: Record<string, any> | null = null;
      if (data.plan === "agency") {
        let workspaceId = agencyMembership?.workspace_uuid;
        if (!workspaceId) {
          const { data: ownedWorkspace } = await admin
            .from("workspaces")
            .select("workspace_uuid")
            .eq("user_id", userId)
            .maybeSingle();
          workspaceId = ownedWorkspace?.workspace_uuid;
        }
        if (workspaceId) {
          const { data: settings } = await admin
            .from("agency_settings")
            .select("system_name,domain,accent,tagline,logo_path")
            .eq("workspace_uuid", workspaceId)
            .maybeSingle();
          agencyBranding = settings;
        }
      }
      // De relationele tabellen zijn vanaf de UUID-migratie de enige bron voor
      // reizen. Een lege tabel moet dus ook een oude JSON-cache leegmaken.
      return {
        ...data,
        data: {
          ...jsonWorkspace,
          plan: data.plan ?? jsonWorkspace.plan,
          baseCurrency: data.base_currency ?? jsonWorkspace.baseCurrency,
          branding: resolveBranding(
            data.plan ?? jsonWorkspace.plan,
            agencyBranding,
            data.branding ?? jsonWorkspace.branding,
          ),
          ...(workspaceRole ? { role: workspaceRole } : {}),
          trips: relationalTrips,
        },
      };
    } catch {
      // De eerste UUID-migratie kan nog niet uitgevoerd zijn; JSON is dan de
      // compatibele bron tot de relationele tabellen beschikbaar zijn.
      return personalWorkspace;
    }
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { tripId: string; name: string; template: string; start: string; budget: number }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Een reisnaam is verplicht.");
    if (name.length > TRIP_NAME_MAX_LENGTH) {
      throw new Error(`De reisnaam mag maximaal ${TRIP_NAME_MAX_LENGTH} tekens bevatten.`);
    }
    if (!isIsoDate(data.start)) throw new Error("Vul een geldige startdatum in.");
    if (!Number.isFinite(data.budget) || data.budget < 0) {
      throw new Error("Het budget moet een bedrag van nul of hoger zijn.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as UntypedSupabase;
    let workspaceOwnerId = context.userId;
    let workspaceId: string | undefined;
    let isAgencyWorkspace = false;
    const { data: agencyMembership } = await db
      .from("workspace_members")
      .select("workspace_uuid, role, permission_overrides")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .neq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (agencyMembership) {
      const [{ data: roleSettings }, { data: agencyWorkspace }] = await Promise.all([
        db
          .from("agency_role_permissions")
          .select("permissions")
          .eq("workspace_uuid", agencyMembership.workspace_uuid)
          .eq("role", agencyMembership.role)
          .maybeSingle(),
        db
          .from("workspaces")
          .select("user_id, plan")
          .eq("workspace_uuid", agencyMembership.workspace_uuid)
          .maybeSingle(),
      ]);
      const permissions = effectiveAgencyPermissions(
        agencyMembership.role,
        roleSettings?.permissions,
        agencyMembership.permission_overrides,
      );
      if (agencyWorkspace?.plan !== "agency" || !permissions.trips_create)
        throw new Error("Je mag geen reizen aanmaken in deze Agency-workspace.");
      workspaceOwnerId = agencyWorkspace.user_id;
      workspaceId = String(agencyMembership.workspace_uuid);
      isAgencyWorkspace = true;
    } else {
      const { data: ownedWorkspace, error: workspaceError } = await db
        .from("workspaces")
        .select("workspace_uuid, plan")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (workspaceError || !ownedWorkspace?.workspace_uuid)
        throw new Error("Workspace niet gevonden.");
      workspaceId = String(ownedWorkspace.workspace_uuid);
      isAgencyWorkspace = ownedWorkspace.plan === "agency";
    }
    if (!workspaceId) throw new Error("Workspace niet gevonden.");
    const { data: trip, error } = await db
      .from("trips")
      .insert({
        // Alleen de middleware bepaalt de eigenaar; de browser kan dit nooit invullen.
        workspace_user_id: workspaceOwnerId,
        workspace_uuid: workspaceId,
        id: data.tripId,
        trip_uuid: data.tripId,
        name,
        template: data.template,
        start_date: data.start,
        end_date: data.start,
        budget: data.budget,
      })
      .select("trip_uuid, revision::text")
      .single();
    if (error) throw error;
    const tripUuid = (trip as { trip_uuid?: unknown } | null)?.trip_uuid;
    if (typeof tripUuid !== "string") throw new Error("Reis-ID kon niet worden aangemaakt.");
    await recordTripManagementAudit(
      db,
      { ownerId: workspaceOwnerId, workspaceId, isAgency: isAgencyWorkspace },
      context.userId,
      "trip.create",
      "trip",
      tripUuid,
    );
    return { tripId: tripUuid, revision: String(trip.revision) };
  });

/** Primary version-checked, atomic write path, including publication settings. */
export const saveTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { trip: Trip }) => input)
  .handler(async ({ data, context }) => {
    let trip = normalizeTripForPersistence(data.trip);
    if (!trip.revision || !/^\d+$/.test(trip.revision)) {
      throw new Error(
        "De reisversie ontbreekt. Herlaad de pagina; controleer of de versiemigratie is uitgevoerd.",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as UntypedSupabase;
    const { data: storedTrip, error: storedError } = await db
      .from("trips")
      .select("workspace_user_id, workspace_uuid")
      .eq("trip_uuid", trip.id)
      .maybeSingle();
    if (storedError || !storedTrip) throw new Error("Reis niet gevonden.");
    const ownerId = String(storedTrip.workspace_user_id);
    let accessRole: TripMemberRole = "owner";
    let agencyPermissions: AgencyPermissionMap | undefined;
    if (ownerId !== context.userId) {
      const [
        { data: membership, error: membershipError },
        { data: workspace, error: workspaceError },
      ] = await Promise.all([
        db
          .from("trip_members")
          .select("role")
          .eq("trip_uuid", trip.id)
          .eq("user_id", context.userId)
          .eq("status", "active")
          .maybeSingle(),
        db
          .from("workspaces")
          .select("plan")
          .eq("workspace_uuid", storedTrip.workspace_uuid)
          .maybeSingle(),
      ]);
      if (membershipError || workspaceError) throw new Error("Je hebt geen toegang tot deze reis.");
      let agencyRole: "advisor" | "finance" | null = null;
      if (workspace?.plan === "agency") {
        const { data: agencyMembership, error: agencyMembershipError } = await db
          .from("workspace_members")
          .select("role, permission_overrides")
          .eq("workspace_uuid", storedTrip.workspace_uuid)
          .eq("user_id", context.userId)
          .eq("status", "active")
          .in("role", ["advisor", "finance"])
          .maybeSingle();
        if (agencyMembershipError)
          throw new Error("Agency-rechten konden niet worden gecontroleerd.");
        if (agencyMembership) {
          agencyRole = agencyMembership.role as "advisor" | "finance";
          const { data: roleSettings, error: roleSettingsError } = await db
            .from("agency_role_permissions")
            .select("permissions")
            .eq("workspace_uuid", storedTrip.workspace_uuid)
            .eq("role", agencyRole)
            .maybeSingle();
          if (roleSettingsError)
            throw new Error("Agency-rechten konden niet worden gecontroleerd.");
          agencyPermissions = effectiveAgencyPermissions(
            agencyRole,
            roleSettings?.permissions,
            agencyMembership.permission_overrides,
          );
        }
      }
      const effectiveAccess = resolveEffectiveTripAccess(
        (membership?.role as TripMemberRole | undefined) ?? null,
        agencyRole,
        agencyPermissions,
      );
      if (!effectiveAccess) throw new Error("Je hebt geen toegang tot deze reis.");
      accessRole = effectiveAccess.role;
      agencyPermissions = effectiveAccess.agencyPermissions;
    }
    if (accessRole === "viewer" || accessRole === "client") {
      throw new Error("Je hebt alleen-lezen toegang tot deze reis.");
    }
    if (accessRole !== "owner") {
      const current = (await loadRelationalTrips(db, ownerId)).find((item) => item.id === trip.id);
      if (!current) throw new Error("Reis niet gevonden.");
      trip = agencyPermissions
        ? protectAgencyTripUpdate(current, trip, agencyPermissions)
        : protectTripUpdate(current, trip, accessRole);
      trip = normalizeTripForPersistence(trip);
    }
    const { data: saved, error } = await db.rpc("save_trip_snapshot_with_options_as", {
      p_workspace_user_id: ownerId,
      p_actor_user_id: context.userId,
      p_trip: trip,
    });
    if (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "PT409") {
        throw new Error(
          "Deze reis is intussen gewijzigd of verwijderd in een ander tabblad of op een ander apparaat. Je wijziging is niet opgeslagen. Kopieer je invoer en herlaad de pagina.",
        );
      }
      if (code === "PGRST202") {
        throw new Error(
          "De database-update voor veilige reisopslag ontbreekt. Voer de versiemigratie uit en herlaad de pagina.",
        );
      }
      throw new Error(
        "Reis kon niet worden opgeslagen. Kopieer je invoer en herlaad de pagina voordat je opnieuw probeert.",
      );
    }
    const row = Array.isArray(saved) ? saved[0] : saved;
    if (
      !row ||
      typeof row !== "object" ||
      !("trip_uuid" in row) ||
      !("revision" in row) ||
      typeof row.trip_uuid !== "string" ||
      typeof row.revision !== "string"
    ) {
      throw new Error("Opslag kon niet worden bevestigd. Herlaad de pagina voordat je verdergaat.");
    }
    return { tripId: row.trip_uuid, revision: row.revision };
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; revision: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as UntypedSupabase;
    const { data: trip, error: tripError } = await db
      .from("trips")
      .select("workspace_user_id, workspace_uuid")
      .eq("trip_uuid", data.tripId)
      .maybeSingle();
    if (tripError || !trip || String(trip.workspace_user_id) !== context.userId) {
      throw new Error("Alleen de eigenaar kan deze reis definitief verwijderen.");
    }
    const { error } = await db.rpc("delete_trip_versioned", {
      p_workspace_user_id: context.userId,
      p_trip_id: data.tripId,
      p_revision: data.revision,
    });
    if (error) {
      throw new Error(
        "Reis kon niet worden verwijderd. Mogelijk is deze intussen gewijzigd. Herlaad de pagina voordat je opnieuw probeert.",
      );
    }
    const { data: workspace } = await db
      .from("workspaces")
      .select("plan")
      .eq("workspace_uuid", trip.workspace_uuid)
      .maybeSingle();
    await recordTripManagementAudit(
      db,
      {
        ownerId: context.userId,
        workspaceId: String(trip.workspace_uuid),
        isAgency: workspace?.plan === "agency",
      },
      context.userId,
      "trip.delete",
      "trip",
      data.tripId,
    );
    return { deleted: true };
  });

export const saveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { data: unknown }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as UntypedSupabase;
    const workspace = data.data as Partial<WorkspaceState>;
    const { data: stored } = await db
      .from("workspaces")
      .select("plan")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Het betaalplan is providergestuurd. Nooit een browserwaarde vertrouwen.
    const plan = ["free", "pro", "agency"].includes(stored?.plan ?? "") ? stored.plan : "free";
    const safeWorkspace = { ...workspace, plan };
    const baseCurrency =
      typeof workspace.baseCurrency === "string" && /^[A-Z]{3}$/.test(workspace.baseCurrency)
        ? workspace.baseCurrency
        : "EUR";
    const { error } = await db.from("workspaces").upsert(
      {
        user_id: context.userId,
        data: safeWorkspace as never,
        plan,
        base_currency: baseCurrency,
        branding: workspace.branding ?? {},
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const updateSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { share_enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("workspaces")
      .update({
        share_enabled: data.share_enabled,
      })
      .eq("user_id", userId)
      .select("public_token, share_enabled")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Workspace niet gevonden.");
    return row;
  });
