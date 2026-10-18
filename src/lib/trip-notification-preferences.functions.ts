import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TripNotificationPreferences = {
  planning: boolean;
  bookings: boolean;
  expenses: boolean;
  documents: boolean;
  flightAlerts: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getTripNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.tripId)) throw new Error("INVALID_TRIP");
    const db = await adminClient();
    const { data: result, error } = await db.rpc("get_trip_notification_preferences", {
      p_actor_id: context.userId,
      p_trip_uuid: data.tripId,
    });
    if (error || !result) throw new Error("TRIP_NOTIFICATION_PREFERENCES_UNAVAILABLE");
    return result as TripNotificationPreferences;
  });

export const saveTripNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { tripId: string; preferences: TripNotificationPreferences }) => input)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.tripId) || Object.values(data.preferences).some((value) => typeof value !== "boolean")) {
      throw new Error("INVALID_TRIP_NOTIFICATION_PREFERENCES");
    }
    const db = await adminClient();
    const { data: saved, error } = await db.rpc("save_trip_notification_preferences", {
      p_actor_id: context.userId,
      p_trip_uuid: data.tripId,
      p_preferences: data.preferences,
    });
    if (error || !saved) throw new Error("TRIP_NOTIFICATION_PREFERENCES_SAVE_FAILED");
    return { ok: true };
  });
