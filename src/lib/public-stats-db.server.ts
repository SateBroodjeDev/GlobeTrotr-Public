import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStatsHandler } from "./public-stats.server";

export const publicStatsResponse = createStatsHandler(async () => {
  const db = supabaseAdmin as any;
  // Count existing records only. Archived trips remain planned trips; deleted rows do not count.
  // Activities are booked/planned activity records, not ambiguous itinerary headings.
  const results = await Promise.all([
    db
      .from("trips")
      .select("trip_uuid", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(10_000)),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(10_000)),
    db
      .from("trip_travel_items")
      .select("id", { count: "exact", head: true })
      .eq("item_type", "activity")
      .abortSignal(AbortSignal.timeout(10_000)),
  ]);
  if (results.some((result) => result.error || result.count === null))
    throw new Error("stats_unavailable");
  return { trips: results[0].count, travelers: results[1].count, activities: results[2].count };
});
