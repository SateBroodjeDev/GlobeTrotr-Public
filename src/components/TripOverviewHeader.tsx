import type { ReactNode } from "react";
import { ArrowRight, BarChart3, CalendarDays, Compass, MapPin, Moon, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Countdown } from "@/components/Countdown";
import { TripCover } from "@/components/TripCover";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calculateTripStatistics } from "@/lib/trip-statistics";
import { tripStatus, type Trip } from "@/lib/types";
import { convert, formatMoney, type Rates } from "@/lib/services";

export function TripOverviewHeader({ trip, base, rates, text, dateLabel, spent, estimatedFuel, billable,
  canMarkBillable, missingNights, actions, coverUrl, onCoverUrlChange, onInsights, onExpenses, onAccommodation }: {
  trip: Trip; base: string; rates: Rates; text: (nl: string, en: string) => string; dateLabel: string;
  spent: number; estimatedFuel: number; billable: number; canMarkBillable: boolean; missingNights: number;
  actions: ReactNode; onInsights: () => void; onExpenses: () => void; onAccommodation: () => void;
  coverUrl?: string | null; onCoverUrlChange?: (url: string | null) => void;
}) {
  const stats = calculateTripStatistics(trip, (amount, currency) => convert(amount, currency, base, rates));
  const status = tripStatus(trip);
  const places = trip.stops.map(stop => stop.name).filter(Boolean);
  const overBudget = trip.budget > 0 && spent > trip.budget;
  return <header className="space-y-3" data-trip-overview-header>
    <Link to="/dashboard" className="inline-flex min-h-9 items-center rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">← {text("Alle reizen", "All trips")}</Link>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="relative hidden h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-primary/10 sm:flex sm:items-center sm:justify-center" aria-hidden="true">
        <Compass className="size-10 stroke-[1] text-primary/60"/>
        <TripCover key={trip.id} tripId={trip.id} editable={false} text={text} compact previewUrl={coverUrl} onUrlChange={onCoverUrlChange} imageClassName="absolute inset-0 h-full w-full object-cover"/>
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`inline-flex items-center gap-1.5 font-medium ${status === "archived" ? "text-muted-foreground" : "text-primary"}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true"/>{status === "current" ? text("Onderweg", "Travelling") : status === "upcoming" ? text("Aankomend", "Upcoming") : trip.archived ? text("Gearchiveerd", "Archived") : text("Afgerond", "Completed")}</span>
          {status === "upcoming" && <Countdown date={trip.start} compact/>}
        </div>
        <h1 className="break-anywhere font-display text-2xl font-semibold leading-tight sm:text-3xl">{trip.name}</h1>
        {places.length > 0 && <p className="mt-1 truncate text-sm text-muted-foreground" title={places.join(" → ")}>{places.slice(0, 3).join(" → ")}{places.length > 3 ? ` +${places.length - 3}` : ""}</p>}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true"/>{dateLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 [&>a]:min-h-10 [&>button]:min-h-10">{actions}</div>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-border/70 py-3">
      <button type="button" onClick={onInsights} className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={text("Alle reisstatistieken bekijken", "View all trip insights")}>
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true"/><strong className="text-foreground">{stats.tripDays}</strong>{text("dagen", "days")}</span>
        <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" aria-hidden="true"/><strong className="text-foreground">{stats.bookedNights}/{stats.nights}</strong>{text("nachten geboekt", "nights booked")}</span>
        <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true"/><strong className="text-foreground">{stats.destinations}</strong>{text("stops", "stops")} · {stats.countries} {text(stats.countries === 1 ? "land" : "landen", stats.countries === 1 ? "country" : "countries")}</span>
        <BarChart3 className="size-4 text-primary" aria-hidden="true"/>
      </button>
      <div className="min-w-0 flex-1 basis-64">
        <button type="button" onClick={onExpenses} className="flex min-h-9 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="inline-flex items-baseline gap-1.5"><Wallet className="size-3.5 self-center text-muted-foreground" aria-hidden="true"/><strong className={overBudget ? "text-destructive" : ""}>{formatMoney(spent, base)}</strong><span className="text-muted-foreground">{trip.budget > 0 ? `/ ${formatMoney(trip.budget, base)}` : text("uitgegeven · geen budget ingesteld", "spent · no budget set")}</span></span>
          <span className="inline-flex items-center gap-1 text-primary">{text("Uitgaven", "Expenses")}<ArrowRight className="size-3.5" aria-hidden="true"/></span>
        </button>
        {trip.budget > 0 && <Progress aria-label={text("Budget gebruikt", "Budget used")} value={Math.max(0, Math.min(100, spent / trip.budget * 100))} className={`h-1 ${overBudget ? "[&>div]:bg-destructive" : ""}`}/>}
        {(estimatedFuel > 0 || canMarkBillable || overBudget) && <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {estimatedFuel > 0 && <span>{text("Brandstofprognose", "Fuel estimate")}: {formatMoney(estimatedFuel, base)}</span>}
          {canMarkBillable && <span>{text("Declarabel", "Billable")}: {formatMoney(billable, base)}</span>}
          {overBudget && <span className="font-medium text-destructive">{text("Boven budget", "Over budget")}</span>}
        </p>}
      </div>
    </div>
    {missingNights > 0 && <Button type="button" variant="ghost" onClick={onAccommodation} className="h-auto min-h-10 w-full justify-start gap-2 whitespace-normal rounded-none border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-500/10 dark:text-amber-200">
      <Moon className="size-4 shrink-0" aria-hidden="true"/><span className="flex-1">{text(`${missingNights} ${missingNights === 1 ? "nacht mist" : "nachten missen"} een verblijf`, `${missingNights} ${missingNights === 1 ? "night has" : "nights have"} no accommodation`)}</span>
      <span className="inline-flex items-center gap-1">{text("Bekijk", "Review")}<ArrowRight className="size-3.5" aria-hidden="true"/></span>
    </Button>}
  </header>;
}
