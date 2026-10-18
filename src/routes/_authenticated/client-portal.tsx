import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, MapPin, Plane, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { useLocale } from "@/lib/locale";
import { supabase } from "@/integrations/supabase/client";
import { isRoutePlanningItem, tripStatus, TEMPLATES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/client-portal")({
  head: () => ({ meta: [{ title: "Klantportaal — GlobeTrotr" }] }),
  component: ClientPortal,
});

function ClientPortal() {
  const { state } = useWorkspace();
  const { text } = useLocale();
  const trips = state.trips.filter((trip) => trip.accessRole === "client" && !trip.archived);
  const documentCounts = useQuery({
    queryKey: ["client-portal-document-counts", trips.map((trip) => trip.id).join(",")],
    enabled: trips.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("trip_documents").select("trip_uuid").in("trip_uuid", trips.map((trip) => trip.id));
      if (error) return {} as Record<string, number>;
      return (data ?? []).reduce((counts: Record<string, number>, row: { trip_uuid: string }) => {
        counts[row.trip_uuid] = (counts[row.trip_uuid] ?? 0) + 1; return counts;
      }, {});
    }, retry: false,
  });

  return <div className="space-y-6">
    <section className="aurora overflow-hidden rounded-3xl px-6 py-9 md:px-10">
      <Badge variant="secondary" className="mb-3"><ShieldCheck className="mr-1 size-3.5" />{text("Veilig klantportaal", "Secure client portal")}</Badge>
      <h1 className="font-display text-3xl font-semibold">{text("Jouw reizen op één plek", "Your trips in one place")}</h1>
      <p className="mt-3 max-w-2xl text-sm opacity-90">{text("Bekijk je planning, boekingen en privé gedeelde reisdocumenten in de huisstijl van je reisorganisatie.", "View your itinerary, bookings and privately shared travel documents in your travel organisation's branding.")}</p>
    </section>
    {!trips.length ? <Card className="surface"><CardContent className="py-10 text-center"><p className="font-medium">{text("Er is nog geen klantreis aan dit account gekoppeld.", "No client trip has been linked to this account yet.")}</p><p className="mt-2 text-sm text-muted-foreground">{text("Neem contact op met je reisorganisatie als je hier een reis verwacht.", "Contact your travel organisation if you expect a trip here.")}</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{trips.map((trip) => {
      const template = TEMPLATES.find((item) => item.id === trip.template);
      const bookings = (trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item));
      const nextBooking = [...bookings].filter((item) => item.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0];
      const nextDay = [...trip.itinerary].filter((item) => item.day >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.day.localeCompare(b.day))[0];
      const status = tripStatus(trip);
      return <Card key={trip.id} className="surface overflow-hidden"><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="break-anywhere">{template?.emoji} {trip.name}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{trip.start} → {trip.end}</p></div><Badge variant="outline">{status === "current" ? text("Nu op reis", "Travelling now") : text("Aankomend", "Upcoming")}</Badge></div></CardHeader><CardContent className="space-y-4">
        {trip.description && <p className="line-clamp-3 text-sm">{trip.description}</p>}
        <div className="grid grid-cols-3 gap-2 text-center text-xs"><Stat icon={MapPin} value={trip.stops.length} label={text("bestemmingen", "destinations")} /><Stat icon={Plane} value={bookings.length} label={text("boekingen", "bookings")} /><Stat icon={FileText} value={documentCounts.data?.[trip.id] ?? 0} label={text("documenten", "documents")} /></div>
        {(nextBooking || nextDay) && <div className="rounded-xl border bg-muted/30 p-3"><p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><CalendarDays className="size-3.5" />{text("Eerstvolgende", "Up next")}</p><p className="truncate text-sm font-medium">{nextBooking?.title ?? nextDay?.title}</p><p className="text-xs text-muted-foreground">{nextBooking?.date ?? nextDay?.day}</p></div>}
        <Button asChild className="w-full"><Link to="/trips/$tripId" params={{ tripId: trip.id }}>{text("Reis openen", "Open trip")}</Link></Button>
      </CardContent></Card>;
    })}</div>}
    <p className="text-xs text-muted-foreground">{text("Je ziet alleen reizen die jouw reisorganisatie expliciet aan dit account heeft gekoppeld.", "You only see trips that your travel organisation explicitly linked to this account.")}</p>
  </div>;
}

function Stat({ icon: Icon, value, label }: { icon: typeof MapPin; value: number; label: string }) {
  return <div className="min-w-0 rounded-xl border p-3"><Icon className="mx-auto mb-1 size-4 text-primary" /><strong className="block text-base">{value}</strong><span className="block truncate text-muted-foreground">{label}</span></div>;
}
