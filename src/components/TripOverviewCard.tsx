import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Compass, MapPin, Wallet } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { DeleteTripButton } from "@/components/DeleteTripButton";
import { TripCover } from "@/components/TripCover";
import { Progress } from "@/components/ui/progress";
import { ownsTrip } from "@/lib/plans";
import { formatMoney } from "@/lib/services";
import { TEMPLATES, tripStatus, type Trip } from "@/lib/types";

type Text = (nl: string, en: string) => string;

export function TripOverviewCard({ trip, spent, base, text, dateLabel, priority, wide, onDelete }: {
  trip: Trip; spent: number; base: string; text: Text; dateLabel: string;
  priority?: string; wide?: boolean; onDelete: () => Promise<void>;
}) {
  const status = tripStatus(trip);
  const label = status === "current" ? text("Onderweg", "Travelling") : status === "upcoming"
    ? text("Aankomend", "Upcoming") : trip.archived ? text("Gearchiveerd", "Archived") : text("Afgerond", "Completed");
  const places = trip.stops.map(stop => stop.name).filter(Boolean);
  const template = TEMPLATES.find(item => item.id === trip.template);
  const overBudget = trip.budget > 0 && spent > trip.budget;
  return <article data-trip-card className={`trip-overview-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card ${priority ? "border-primary/45" : "border-border/70"} ${wide ? "md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}>
    <div className={`relative isolate overflow-hidden bg-primary/10 ${wide ? "h-40 md:h-full md:min-h-56" : "h-36 sm:h-40"}`}>
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden text-primary/60" aria-hidden="true">
        <div className="absolute -right-8 -top-16 size-60 rounded-full border border-primary/15"/>
        <div className="absolute -left-12 -bottom-24 size-64 rounded-full border border-primary/15"/>
        <svg viewBox="0 0 360 160" className="absolute inset-0 h-full w-full opacity-40" fill="none">
          <path d="M-20 140C55 150 65 55 140 75S220 145 260 70 330 45 390 15" stroke="currentColor" strokeWidth="2" strokeDasharray="5 7"/>
          <circle cx="140" cy="75" r="5" fill="currentColor"/><circle cx="260" cy="70" r="5" fill="currentColor"/>
        </svg>
        <Compass className="size-12 stroke-[1]"/>
      </div>
      <TripCover tripId={trip.id} editable={false} text={text} compact imageClassName="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.035]"/>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true"/>
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">{priority || label}</span>
        {!ownsTrip(trip.accessRole) && <span className="rounded-full bg-background/95 px-2.5 py-1 text-[11px] text-foreground">{text("Gedeeld", "Shared")}</span>}
      </div>
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 break-anywhere font-display text-lg font-semibold leading-snug">
            <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="trip-card-link rounded-sm focus-visible:outline-none">
              <span className="mr-1.5" aria-hidden="true">{template?.emoji}</span>{trip.name}
            </Link>
          </h2>
          {ownsTrip(trip.accessRole) && <div className="relative z-10 -mr-2 -mt-1 shrink-0"><DeleteTripButton tripName={trip.name} iconOnly onDelete={onDelete}/></div>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true"/>{dateLabel}</span>{status === "upcoming" && <Countdown date={trip.start} compact/>}</div>
        <p className="mt-2 truncate text-sm text-muted-foreground" title={places.join(" → ")}>
          {places.length ? places.slice(0, 3).join(" → ") + (places.length > 3 ? ` +${places.length - 3}` : "") : text("Je route begint hier", "Your route starts here")}
        </p>
      </div>
      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true"/>{trip.stops.length} {text(trip.stops.length === 1 ? "bestemming" : "bestemmingen", trip.stops.length === 1 ? "destination" : "destinations")}</span>
          <span className="inline-flex items-center gap-1"><Wallet className="size-3.5" aria-hidden="true"/>{trip.expenses.length} {text(trip.expenses.length === 1 ? "uitgave" : "uitgaven", trip.expenses.length === 1 ? "expense" : "expenses")}</span>
          <ArrowRight className="ml-auto size-4 text-primary motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true"/>
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
            <span><strong className={overBudget ? "text-destructive" : "font-semibold"}>{formatMoney(spent, base)}</strong>{trip.budget > 0 && <span className="text-muted-foreground"> / {formatMoney(trip.budget, base)}</span>}</span>
            {trip.budget > 0 ? <span className={overBudget ? "text-destructive" : "text-muted-foreground"}>{overBudget ? text("Boven budget", "Over budget") : text("van budget", "of budget")}</span> : <span className="text-muted-foreground">{text("Geen budget ingesteld", "No budget set")}</span>}
          </div>
          {trip.budget > 0 && <Progress aria-label={text("Budget gebruikt", "Budget used")} value={Math.max(0, Math.min(100, spent / trip.budget * 100))} className={`h-1 ${overBudget ? "[&>div]:bg-destructive" : ""}`}/>}
        </div>
      </div>
    </div>
  </article>;
}
