import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function context(userId: string, tripUuid: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: trip } = await (db as any)
    .from("trips")
    .select("trip_uuid,workspace_user_id")
    .eq("trip_uuid", tripUuid)
    .maybeSingle();
  if (!trip || trip.workspace_user_id !== userId) throw new Error("TRIP_OWNER_REQUIRED");
  const { data: workspace } = await (db as any)
    .from("workspaces")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (!["pro", "agency"].includes(workspace?.plan)) throw new Error("PRO_REQUIRED");
  return db as any;
}

export const getCalendarFeedStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripUuid: string }) => input)
  .handler(async ({ data, context: auth }: any) => {
    const db = await context(auth.userId, data.tripUuid);
    const { data: feed, error } = await db
      .from("trip_calendar_feeds")
      .select("id,created_at")
      .eq("trip_uuid", data.tripUuid)
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) throw new Error("CALENDAR_FEED_STATUS_UNAVAILABLE");
    return feed ?? null;
  });

export const createCalendarFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripUuid: string }) => input)
  .handler(async ({ data, context: auth }: any) => {
    const db = await context(auth.userId, data.tripUuid);
    const token = randomBytes(32).toString("base64url");
    const { data: created, error } = await db
      .from("trip_calendar_feeds")
      .insert({
        trip_uuid: data.tripUuid,
        created_by: auth.userId,
        token_hash: createHash("sha256").update(token).digest("hex"),
      })
      .select("id")
      .single();
    if (error) throw new Error("CALENDAR_FEED_CREATE_FAILED");
    const { data: preview, error: previewError } = await db.rpc("get_trip_calendar_feed", { p_token: token });
    if (previewError || !preview) {
      await db.from("trip_calendar_feeds").delete().eq("id", created.id);
      throw new Error("CALENDAR_FEED_NOT_AVAILABLE");
    }
    // The RPC validates the same secret token used by the public calendar
    // endpoint. Calling our own public hostname here caused false failures on
    // hosts with split DNS, reverse-proxy hairpinning or an unavailable IPv6
    // route, even though calendar clients could open the generated feed.
    if (typeof preview !== "object" || typeof preview.name !== "string") {
      await db.from("trip_calendar_feeds").delete().eq("id", created.id);
      throw new Error("CALENDAR_FEED_NOT_AVAILABLE");
    }
    const { error: revokeError } = await db
      .from("trip_calendar_feeds")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("trip_uuid", data.tripUuid)
      .eq("active", true)
      .neq("id", created.id);
    if (revokeError) {
      await db.from("trip_calendar_feeds").delete().eq("id", created.id);
      throw new Error("CALENDAR_FEED_ROTATE_FAILED");
    }
    return { url: `https://portal.globetrotr.nl/calendar/${token}.ics` };
  });

export const revokeCalendarFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripUuid: string }) => input)
  .handler(async ({ data, context: auth }: any) => {
    const db = await context(auth.userId, data.tripUuid);
    const { error } = await db
      .from("trip_calendar_feeds")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("trip_uuid", data.tripUuid)
      .eq("active", true);
    if (error) throw new Error("CALENDAR_FEED_REVOKE_FAILED");
    return { ok: true };
  });
