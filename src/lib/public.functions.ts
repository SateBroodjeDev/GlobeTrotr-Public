import { createServerFn } from "@tanstack/react-start";

export type PublicStop = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  arrive?: string;
  nights?: number;
};
export type PublicDay = { day: string; title: string; notes?: string | undefined };
export type PublicTravelLocation = { name: string; country: string };
export type PublicTravelItem = {
  type: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  transportMode?: string;
  departure?: PublicTravelLocation;
  arrival?: PublicTravelLocation;
  location?: PublicTravelLocation;
};
export type PublicJournalEntry = { id: string; date: string; title: string; body: string; location?: string; rating?: number; photos: Array<{ url: string; caption?: string }>; videos: Array<{ url: string; caption?: string }>; likes: number; comments: Array<{ id: string; name: string; body: string; createdAt: string }> };
export type PublicJournalSummary = { title: string; body: string; selectedEntryIds: string[] };

export type PublicTripCard = {
  token: string;
  tripId: string;
  name: string;
  description?: string;
  template: string;
  start: string;
  end: string;
  stops: PublicStop[];
  authorName: string;
  coverUrl?: string;
  branding?: { brandName: string; domain: string; tagline: string; accent: number };
};

export type PublicTripDetail = PublicTripCard & {
  itinerary: PublicDay[];
  travelItems: PublicTravelItem[];
  journal: PublicJournalEntry[];
  journalSummary?: PublicJournalSummary;
  weatherEnabled: boolean;
  budget?: number;
  currency?: string;
};

export type PublicTripResult =
  { status: "not_found" } | { status: "pin_required" } | { status: "ok"; trip: PublicTripDetail };

type Row = {
  user_id: string;
  data: unknown;
  public_token: string;
};

type RelationalTrip = {
  trip_uuid: string;
  workspace_user_id: string;
  name: string;
  description: string | null;
  template: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | string;
  share_financials: boolean;
  share_pin_hash: string | null;
};

type RelationalStop = Omit<PublicStop, "arrive"> & {
  trip_uuid: string;
  arrive_date?: string | null;
  position?: number;
};
type RelationalDay = PublicDay & { trip_uuid: string; position: number };
type RelationalTravelItem = {
  id: string;
  item_type: string;
  title: string;
  start_date: string;
  end_date: string | null;
  departure: unknown;
  arrival: unknown;
  location: unknown;
  details: unknown;
};
type WorkspaceBrand = {
  user_id: string;
  public_token: string;
  branding: unknown;
  data: unknown;
  plan?: string;
};
type PublicProfile = { id: string; display_name: string | null };
type UntypedSupabase = { from: (relation: string) => any };

type AnyTrip = Record<string, unknown>;

function publicLocation(value: unknown): PublicTravelLocation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const location = value as Record<string, unknown>;
  const name = String(location["name"] ?? "").trim();
  if (!name) return undefined;
  return { name, country: String(location["country"] ?? "") };
}

function publicTravelItem(item: AnyTrip): PublicTravelItem | undefined {
  const details =
    item["details"] && typeof item["details"] === "object"
      ? (item["details"] as Record<string, unknown>)
      : {};
  if (details["sharePublicly"] !== true || details["routePlanningOnly"] === true || String(item["id"] ?? "").startsWith("route-leg:")) return undefined;
  return {
    type: String(item["type"] ?? "activity"),
    title: String(item["title"] ?? ""),
    date: String(item["date"] ?? ""),
    ...(item["endDate"] ? { endDate: String(item["endDate"]) } : {}),
    ...(details["startTime"] ? { startTime: String(details["startTime"]) } : {}),
    ...(details["endTime"] ? { endTime: String(details["endTime"]) } : {}),
    ...(details["transportMode"] ? { transportMode: String(details["transportMode"]) } : {}),
    ...(publicLocation(item["departure"]) ? { departure: publicLocation(item["departure"]) } : {}),
    ...(publicLocation(item["arrival"]) ? { arrival: publicLocation(item["arrival"]) } : {}),
    ...(publicLocation(item["location"]) ? { location: publicLocation(item["location"]) } : {}),
  };
}

function relationalPublicTravelItem(item: RelationalTravelItem): PublicTravelItem | undefined {
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : {};
  if (details["sharePublicly"] !== true || details["routePlanningOnly"] === true || item.id.startsWith("route-leg:")) return undefined;
  return {
    type: item.item_type,
    title: item.title,
    date: item.start_date,
    ...(item.end_date ? { endDate: item.end_date } : {}),
    ...(details["startTime"] ? { startTime: String(details["startTime"]) } : {}),
    ...(details["endTime"] ? { endTime: String(details["endTime"]) } : {}),
    ...(details["transportMode"] ? { transportMode: String(details["transportMode"]) } : {}),
    ...(publicLocation(item.departure) ? { departure: publicLocation(item.departure) } : {}),
    ...(publicLocation(item.arrival) ? { arrival: publicLocation(item.arrival) } : {}),
    ...(publicLocation(item.location) ? { location: publicLocation(item.location) } : {}),
  };
}

export async function createPublicDatabaseClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Publieke databaseconfiguratie ontbreekt.");
  const { createClient } = await import("@supabase/supabase-js");
  const publicFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient(url, key, {
    global: { fetch: publicFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function attachPublicJournal(trip: PublicTripDetail, tripId: string) {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"] || !/^[0-9a-f-]{36}$/i.test(tripId)) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data } = await admin.from("trip_journal_entries").select("id,entry_date,title,body,location_name,rating,photo_paths,photo_captions,video_paths,video_captions").eq("trip_uuid", tripId).eq("visibility", "public").order("entry_date");
  trip.journal = await Promise.all((data ?? []).map(async (entry: any) => {
    const prefix = `${tripId}/${entry.id}/`;
    const paths = ((entry.photo_paths ?? []) as unknown[])
      .filter((path): path is string => typeof path === "string" && path.startsWith(prefix) && /^[0-9a-zA-Z._/-]+$/.test(path))
      .slice(0, 8);
    const signed = paths.length ? await admin.storage.from("trip-journal").createSignedUrls(paths, 900) : { data: [] };
    const videoPaths = ((entry.video_paths ?? []) as unknown[]).filter((path): path is string => typeof path === "string" && path.startsWith(prefix) && /^[0-9a-zA-Z._/-]+$/.test(path)).slice(0, 2);
    const signedVideos = videoPaths.length ? await admin.storage.from("trip-journal").createSignedUrls(videoPaths, 900) : { data: [] };
    const { data: reactions } = await admin.from("trip_journal_reactions").select("id,liked,display_name,comment,created_at").eq("entry_id",entry.id).eq("status","visible").order("created_at",{ascending:false}).limit(1000);
    return { id: entry.id, date: entry.entry_date, title: entry.title, body: entry.body, ...(entry.location_name ? { location: entry.location_name } : {}), ...(entry.rating ? { rating: entry.rating } : {}), photos: paths.flatMap((path, index) => signed.data?.[index]?.signedUrl ? [{ url: signed.data[index]!.signedUrl!, ...(entry.photo_captions?.[path] ? { caption: String(entry.photo_captions[path]) } : {}) }] : []), videos: videoPaths.flatMap((path,index)=>signedVideos.data?.[index]?.signedUrl?[{url:signedVideos.data[index]!.signedUrl!,...(entry.video_captions?.[path]?{caption:String(entry.video_captions[path])}:{})}]:[]), likes:(reactions??[]).filter((reaction:any)=>reaction.liked).length, comments:(reactions??[]).filter((reaction:any)=>reaction.comment&&reaction.display_name).slice(0,20).map((reaction:any)=>({id:reaction.id,name:reaction.display_name,body:reaction.comment,createdAt:reaction.created_at})) } satisfies PublicJournalEntry;
  }));
  const { data: summary } = await admin.from("trip_journal_summaries").select("title,body,selected_entry_ids").eq("trip_uuid",tripId).eq("visibility","public").maybeSingle();
  if(summary){const publicIds=new Set((trip.journal??[]).map(entry=>entry.id));trip.journalSummary={title:summary.title,body:summary.body,selectedEntryIds:(summary.selected_entry_ids??[]).filter((id:string)=>publicIds.has(id))};}
}

function tripsOf(row: Row, includePinProtected = true): AnyTrip[] {
  const data = row.data as { trips?: AnyTrip[] } | null;
  if (!data || !Array.isArray(data.trips)) return [];
  return data.trips.filter(
    (t) =>
      t &&
      (t as { public?: boolean }).public === true &&
      (includePinProtected || !(t as { sharePinHash?: unknown }).sharePinHash),
  );
}

function authorOf(profile?: PublicProfile): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  return "Een GlobeTrotr-reiziger";
}

function relationalCard(
  workspace: WorkspaceBrand,
  trip: RelationalTrip,
  stops: RelationalStop[],
  authorName: string,
): PublicTripCard {
  return {
    token: workspace.public_token,
    tripId: trip.trip_uuid,
    name: trip.name,
    ...(trip.description ? { description: trip.description } : {}),
    template: trip.template,
    start: trip.start_date ?? "",
    end: trip.end_date ?? "",
    authorName,
    stops: stops.map(({ trip_uuid: _tripUuid, arrive_date, position: _position, ...stop }) => ({
      ...stop,
      ...(arrive_date ? { arrive: arrive_date } : {}),
    })),
  };
}

function card(row: Row, t: AnyTrip, authorName: string): PublicTripCard {
  const stops = Array.isArray(t["stops"]) ? (t["stops"] as AnyTrip[]) : [];
  return {
    token: row.public_token,
    tripId: String(t["id"] ?? ""),
    name: String(t["name"] ?? "Reis"),
    ...(t["description"] ? { description: String(t["description"]) } : {}),
    template: String(t["template"] ?? "citytrip"),
    start: String(t["start"] ?? ""),
    end: String(t["end"] ?? ""),
    authorName,
    stops: stops.map((s) => ({
      name: String(s["name"] ?? ""),
      country: String(s["country"] ?? ""),
      lat: Number(s["lat"] ?? 0),
      lon: Number(s["lon"] ?? 0),
      ...(s["arrive"] ? { arrive: String(s["arrive"]) } : {}),
      ...(Number.isFinite(Number(s["nights"])) ? { nights: Number(s["nights"]) } : {}),
    })),
  };
}

export const listPublicTrips = createServerFn({ method: "GET" }).handler(async () => {
  const publicDb = await createPublicDatabaseClient();
  const { data, error } = await publicDb.rpc("list_public_trip_cards" as never);
  if (error || !Array.isArray(data)) return [] as PublicTripCard[];
  return data as PublicTripCard[];
});
export const getPublicTrip = createServerFn({ method: "GET" })
  .validator((input: { token: string; tripId: string; pin?: string }) => input)
  .handler(async ({ data: input }) => {
    const publicDb = await createPublicDatabaseClient();
    const submittedPinHash = input.pin ? await hashPin(input.pin) : null;
    const { data: publicResult, error: publicError } = await publicDb.rpc(
      "get_public_trip" as never,
      { p_token: input.token, p_trip_id: input.tripId, p_pin_hash: submittedPinHash } as never,
    );
    if (!publicError && publicResult && typeof publicResult === "object") {
      const result = publicResult as unknown as PublicTripResult;
      if (result.status === "ok") {
        result.trip.stops = Array.isArray(result.trip.stops) ? result.trip.stops : [];
        result.trip.itinerary = Array.isArray(result.trip.itinerary) ? result.trip.itinerary : [];
        result.trip.travelItems = Array.isArray(result.trip.travelItems) ? result.trip.travelItems : [];
        result.trip.journal = [];
        result.trip.weatherEnabled = Boolean(result.trip.weatherEnabled);
        const { data: branding } = await publicDb.rpc("get_public_trip_branding" as never, { p_token: input.token, p_trip_id: input.tripId } as never);
        if (branding && typeof branding === "object") {
          result.trip.branding = branding as PublicTripDetail["branding"];
          result.trip.authorName = result.trip.branding?.brandName || result.trip.authorName;
        }
        if (process.env["SUPABASE_SERVICE_ROLE_KEY"] && /^[0-9a-f-]{36}$/i.test(input.tripId)) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: coveredTrip } = await supabaseAdmin.from("trips").select("cover_path").eq("trip_uuid", input.tripId).eq("is_public", true).eq("archived", false).maybeSingle();
          if (coveredTrip?.cover_path) {
            const { data: signed } = await supabaseAdmin.storage.from("trip-covers").createSignedUrl(coveredTrip.cover_path, 900);
            if (signed?.signedUrl) result.trip.coverUrl = signed.signedUrl;
          }
          await attachPublicJournal(result.trip, input.tripId);
        }
      }
      return result;
    }
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      return { status: "not_found" } as PublicTripResult;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as UntypedSupabase;
    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .select("user_id, data, public_token, branding, plan")
      .eq("public_token", input.token)
      .maybeSingle();
    if (error || !data) return { status: "not_found" } as PublicTripResult;

    const workspace = data as WorkspaceBrand;
    const { data: profile } = await db
      .from("profiles")
      .select("id, display_name")
      .eq("id", workspace.user_id)
      .maybeSingle();
    const authorName = authorOf((profile as PublicProfile | null | undefined) ?? undefined);
    const { data: byUuid, error: uuidError } = await db
      .from("trips")
      .select(
        "trip_uuid, workspace_user_id, name, description, template, start_date, end_date, budget, share_financials, share_pin_hash",
      )
      .eq("workspace_user_id", workspace.user_id)
      .eq("trip_uuid", input.tripId)
      .eq("is_public", true)
      .eq("archived", false)
      .maybeSingle();
    // Oude URLs hebben nog de tijdelijke tekst-ID. Houd deze bruikbaar totdat
    // de private app en JSON-cache volledig op de UUID werken.
    const { data: byLegacyId } =
      byUuid || uuidError
        ? await db
            .from("trips")
            .select(
              "trip_uuid, workspace_user_id, name, description, template, start_date, end_date, budget, share_financials, share_pin_hash",
            )
            .eq("workspace_user_id", workspace.user_id)
            .eq("id", input.tripId)
            .eq("is_public", true)
            .eq("archived", false)
            .maybeSingle()
        : { data: null };
    const normalizedTrip = (byUuid ?? byLegacyId) as RelationalTrip | null;
    if (normalizedTrip) {
      if (
        normalizedTrip.share_pin_hash &&
        (await hashPin(input.pin ?? "")) !== normalizedTrip.share_pin_hash
      ) {
        return { status: "pin_required" } as PublicTripResult;
      }
      const [{ data: stops }, { data: itinerary }, { data: travelItems }] = await Promise.all([
        db
          .from("trip_stops")
          .select("trip_uuid, name, country, lat, lon, arrive_date, nights, position")
          .eq("trip_uuid", normalizedTrip.trip_uuid)
          .order("position"),
        db
          .from("trip_itinerary_items")
          .select("trip_uuid, day, title, notes, position")
          .eq("trip_uuid", normalizedTrip.trip_uuid)
          .order("day")
          .order("position"),
        db
          .from("trip_travel_items")
          .select("id, item_type, title, start_date, end_date, departure, arrival, location, details")
          .eq("trip_uuid", normalizedTrip.trip_uuid)
          .order("start_date"),
      ]);
      const detail: PublicTripDetail = {
        ...relationalCard(workspace, normalizedTrip, (stops ?? []) as RelationalStop[], authorName),
        itinerary: ((itinerary ?? []) as RelationalDay[]).map(
          ({ trip_uuid: _tripUuid, position: _position, ...item }) => item,
        ),
        travelItems: ((travelItems ?? []) as RelationalTravelItem[])
          .map(relationalPublicTravelItem)
          .filter((item): item is PublicTravelItem => Boolean(item)),
        journal: [],
        weatherEnabled: workspace.plan === "pro" || workspace.plan === "agency",
      };
      await attachPublicJournal(detail, normalizedTrip.trip_uuid);
      if (normalizedTrip.share_financials) {
        detail.budget = Number(normalizedTrip.budget ?? 0);
        detail.currency = "EUR";
      }
      return { status: "ok", trip: detail } as PublicTripResult;
    }

    const row = data as Row;
    const trip = tripsOf(row).find((t) => String(t["id"]) === input.tripId);
    if (!trip || trip["archived"] === true) return { status: "not_found" } as PublicTripResult;
    const pinHash = typeof trip["sharePinHash"] === "string" ? trip["sharePinHash"] : null;
    if (pinHash && (await hashPin(input.pin ?? "")) !== pinHash) {
      return { status: "pin_required" } as PublicTripResult;
    }
    const detail: PublicTripDetail = {
      ...card(row, trip, authorName),
      itinerary: (Array.isArray(trip["itinerary"]) ? (trip["itinerary"] as AnyTrip[]) : []).map(
        (d) => ({
          day: String(d["day"] ?? ""),
          title: String(d["title"] ?? ""),
          notes: d["notes"] ? String(d["notes"]) : undefined,
        }),
      ),
      travelItems: (Array.isArray(trip["travelItems"]) ? (trip["travelItems"] as AnyTrip[]) : [])
        .map(publicTravelItem)
        .filter((item): item is PublicTravelItem => Boolean(item)),
      journal: [],
      weatherEnabled:
        (row.data as AnyTrip | null)?.["plan"] === "pro" ||
        (row.data as AnyTrip | null)?.["plan"] === "agency",
    };
    if (trip["shareFinancials"] === true) {
      detail.budget = Number(trip["budget"] ?? 0);
      detail.currency = "EUR";
    }
    return { status: "ok", trip: detail } as PublicTripResult;
  });

export async function hashPin(pin: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
