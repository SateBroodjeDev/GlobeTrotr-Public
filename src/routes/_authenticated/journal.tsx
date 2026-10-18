import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookHeart, CalendarDays, MapPin } from "lucide-react";
import { TripJournal } from "@/components/TripJournal";
import { useWorkspace } from "@/lib/workspace";
import { canPlanTrip } from "@/lib/plans";
import { tripStatus } from "@/lib/types";
import { resolveTripCapability } from "@/lib/agency-permissions";
import { getMyAgencyAccess } from "@/lib/agency.functions";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/journal")({
  validateSearch: (search: Record<string, unknown>) => ({ trip: typeof search.trip === "string" ? search.trip : undefined }),
  head: () => ({ meta: [{ title: "Reisdagboek - GlobeTrotr" }, { name: "description", content: "Schrijf, bewaar en deel herinneringen van je reizen." }] }),
  component: JournalPage,
});

function JournalPage() {
  const { state } = useWorkspace();
  const { user } = useAuth();
  const { text } = useLocale();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const sorted = [...state.trips].sort((left, right) => {
    const order = { current: 0, upcoming: 1, archived: 2 };
    return order[tripStatus(left)] - order[tripStatus(right)] || right.start.localeCompare(left.start);
  });
  const trip = sorted.find((item) => item.id === search.trip) ?? sorted[0];
  const role = trip?.accessRole ?? "owner";
  const agencyAccess = useQuery({
    queryKey: ["journal-agency-access", user?.id, trip?.id],
    enabled: Boolean(user && trip && state.plan === "agency" && role !== "owner"),
    queryFn: () => getMyAgencyAccess(),
    retry: false,
  });
  const editable = trip ? resolveTripCapability(agencyAccess.isLoading && role !== "owner", agencyAccess.data?.permissions, "trips_plan", canPlanTrip(role)) : false;

  if (!trip) return <div className="mx-auto max-w-5xl space-y-6"><Header text={text} /><Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">{text("Maak eerst een reis om herinneringen te bewaren.", "Create a trip before saving memories.")}</p><Link to="/dashboard" className="mt-3 inline-block text-sm text-primary underline">{text("Naar Reizen", "Go to Trips")}</Link></CardContent></Card></div>;

  return <div className="mx-auto max-w-7xl space-y-6"><Header text={text} /><section className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-4"><label className="min-w-0 flex-1 space-y-1 text-sm"><span className="font-medium">{text("Reis kiezen", "Choose trip")}</span><select className="h-11 w-full max-w-xl rounded-lg border bg-background px-3" value={trip.id} onChange={(event) => void navigate({ to: "/journal", search: { trip: event.target.value } })}>{sorted.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Link to="/trips/$tripId" params={{ tripId: trip.id }} className="text-sm text-primary underline">{text("Reis openen", "Open trip")}</Link></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{trip.start} - {trip.end}</span><span className="flex items-center gap-1.5"><MapPin className="size-4" />{trip.stops.length} {text(trip.stops.length === 1 ? "bestemming" : "bestemmingen", trip.stops.length === 1 ? "destination" : "destinations")}</span></div></section><TripJournal tripId={trip.id} tripName={trip.name} start={trip.start} end={trip.end} editable={editable} stops={trip.stops} /></div>;
}

function Header({ text }: { text: (nl: string, en: string) => string }) {
  return <header className="aurora rounded-[2rem] p-6 sm:p-9"><BookHeart className="size-8 text-primary" /><h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{text("Mijn reisdagboek", "My travel journal")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{text("Herinneringen, foto's, offline verhalen en reissamenvattingen overzichtelijk per reis.", "Memories, photos, offline stories and trip summaries organised by trip.")}</p></header>;
}
