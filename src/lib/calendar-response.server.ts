import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildTripCalendar } from "@/lib/exporters";
import type { Trip, TravelItem } from "@/lib/types";

export async function tripCalendarResponse(rawToken: string) {
  // The dynamic /calendar/$token route also receives subscription URLs ending
  // in .ics. Keeping this in one route avoids an overlapping literal route in
  // TanStack Router while calendar clients still receive a conventional URL.
  const token = rawToken.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const { data, error } = await (supabaseAdmin as any).rpc("get_trip_calendar_feed", { p_token: token });
  if (error || !data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const bookings = Array.isArray(data.bookings) ? data.bookings : [];
  const trip = {
    id: "calendar", name: String(data.name ?? "GlobeTrotr"), template: "citytrip",
    start: String(data.start ?? ""), end: String(data.end ?? ""), budget: 0, stops: [], expenses: [],
    itinerary: (Array.isArray(data.itinerary) ? data.itinerary : []).map((item: any) => ({ id: String(item.id), day: String(item.day), title: String(item.title), ...(item.notes ? { notes: String(item.notes) } : {}) })),
    travelItems: bookings.flatMap((item: any): TravelItem[] => {
      const details = item.details && typeof item.details === "object" ? item.details : {};
      if (details.routePlanningOnly === true || String(item.id ?? "").startsWith("route-leg:")) return [];
      return [{ id: String(item.id), type: item.item_type, title: String(item.title), date: String(item.start_date), ...(item.end_date ? { endDate: String(item.end_date) } : {}), ...(item.notes ? { notes: String(item.notes) } : {}), departure: item.departure ?? undefined, arrival: item.arrival ?? undefined, location: item.location ?? undefined, details }];
    }),
  } as Trip;
  return new Response(buildTripCalendar(trip), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${token.slice(0, 12)}.ics"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
