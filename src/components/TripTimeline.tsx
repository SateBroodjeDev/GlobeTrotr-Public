import { useMemo, useState } from "react";
import {
  BedDouble,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  MapPin,
  Plane,
  Pencil,
  Ticket,
  TrainFront,
  Trash2,
} from "lucide-react";
import { type ItineraryItem, type TravelItem, type Trip } from "@/lib/types";
import { formatMoney } from "@/lib/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale";
import { buildTripTimelineEntries, tripTimelineDays, tripDayOverview, type TimelineEntry } from "@/lib/trip-timeline";

type TimelineFilter = "all" | TimelineEntry["kind"];

const icons = {
  manual: Ticket,
  flight: Plane,
  lodging: BedDouble,
  transport: TrainFront,
  car_rental: Car,
  activity: Ticket,
} as const;

function dateLabel(date: string, locale: "nl-NL" | "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function detailFor(item: TravelItem, text: (nl: string, en: string) => string) {
  const location =
    item.departure && item.arrival
      ? `${item.departure.name} \u2192 ${item.arrival.name}`
      : item.location?.name;
  const values = [
    location,
    item.provider,
    item.bookingReference ? `${text("Boeking", "Booking")} ${item.bookingReference}` : undefined,
    item.flightStatus,
  ].filter(Boolean);
  return values.join(" · ");
}

export function TripTimeline({
  trip,
  baseCurrency,
  editable,
  onAddBooking,
  onRemove,
  onUpdate,
  onEditBooking,
  onFindStay,
}: {
  trip: Trip;
  baseCurrency: string;
  editable: boolean;
  onAddBooking?: () => void;
  onRemove: (id: string) => Promise<void>;
  onUpdate?: (item: ItineraryItem) => Promise<void>;
  onEditBooking?: (item: TravelItem) => void;
  onFindStay?: () => void;
}) {
  const { locale, text } = useLocale();
  // A long trip stays usable by opening one day at a time. The complete
  // itinerary remains one click away for overview and printing.
  const [mode, setMode] = useState<"all" | "day">("day");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => new Set());
  const [selectedDay, setSelectedDay] = useState(trip.start);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const entries = useMemo(() => buildTripTimelineEntries(trip, text), [text, trip]);
  const dates = useMemo(() => tripTimelineDays(trip, entries), [entries, trip]);
  const focusedDay = dates.includes(selectedDay) ? selectedDay : dates[0] || trip.start;
  const filteredEntries =
    filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);
  const visible =
    mode === "day" ? filteredEntries.filter((entry) => entry.day === focusedDay) : filteredEntries;
  const filterOptions: Array<{ value: TimelineFilter; label: string }> = [
    { value: "all", label: text("Alles", "All") },
    { value: "flight", label: text("Vluchten", "Flights") },
    { value: "lodging", label: text("Verblijven", "Stays") },
    { value: "transport", label: text("Vervoer", "Transport") },
    { value: "car_rental", label: text("Huurauto's", "Rental cars") },
    { value: "activity", label: text("Activiteiten", "Activities") },
    { value: "manual", label: text("Eigen planning", "Custom items") },
  ];

  function toggleDay(day: string) {
    setCollapsedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function moveDay(direction: number) {
    const current = dates.indexOf(focusedDay);
    setSelectedDay(
      dates[Math.max(0, Math.min(dates.length - 1, current + direction))] ?? focusedDay,
    );
  }

  async function removeManualItem(id: string) {
    if (!window.confirm(text("Dit programma-item verwijderen?", "Delete this itinerary item?")))
      return;
    setSaving(true);
    try {
      await onRemove(id);
    } catch {
      // The parent displays the server error and restores the previous state.
    } finally {
      setSaving(false);
    }
  }

  async function saveManualItem() {
    if (!editing || !onUpdate || saving || !editing.title.trim() || !editing.day) return;
    setSaving(true);
    try {
      await onUpdate({ ...editing, title: editing.title.trim() });
      setSelectedDay(editing.day);
      setEditing(null);
    } catch {
      // Keep the draft open; the parent reports the save error.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="surface">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm">{text("Dagplanning", "Daily itinerary")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => setMode("all")}
          >
            {text("Hele reis", "Full trip")}
          </Button>
          <Button
            size="sm"
            variant={mode === "day" ? "default" : "outline"}
            onClick={() => setMode("day")}
          >
            {text("Per dag", "By day")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open && !saving) setEditing(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{text("Programma-item wijzigen", "Edit itinerary item")}</DialogTitle>
              <DialogDescription>
                {text("Pas de datum, naam of notities aan.", "Change the date, name or notes.")}
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveManualItem();
                }}
              >
                <fieldset disabled={saving} className="space-y-4">
                  <label className="block space-y-1 text-sm">
                    {text("Datum", "Date")}
                    <Input
                      required
                      type="date"
                      value={editing.day}
                      onChange={(event) => setEditing({ ...editing, day: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    {text("Naam", "Name")}
                    <Input
                      required
                      value={editing.title}
                      onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    {text("Notities", "Notes")}
                    <Input
                      value={editing.notes ?? ""}
                      onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                      {text("Annuleren", "Cancel")}
                    </Button>
                    <Button type="submit" disabled={!editing.title.trim() || !editing.day}>
                      {saving
                        ? text("Opslaan\u2026", "Saving\u2026")
                        : text("Wijzigingen opslaan", "Save changes")}
                    </Button>
                  </div>
                </fieldset>
              </form>
            )}
          </DialogContent>
        </Dialog>
        {mode === "day" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/35 p-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={text("Vorige dag", "Previous day")}
              onClick={() => moveDay(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              aria-label={text("Kies een dag", "Choose a day")}
              type="date"
              value={focusedDay}
              min={trip.start}
              max={trip.end}
              className="w-auto"
              onChange={(event) => setSelectedDay(event.target.value)}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={text("Volgende dag", "Next day")}
              onClick={() => moveDay(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{text("Het dagoverzicht telt alle boekingen; het filter hieronder verandert alleen de lijst.", "The day overview includes all bookings; the filter below changes only the list.")}</p>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label={text("Filter dagplanning", "Filter itinerary")}
        >
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              className="shrink-0"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {editable && onAddBooking && (
          <div className="flex justify-end">
            <Button onClick={onAddBooking}>{text("Boeking toevoegen", "Add booking")}</Button>
          </div>
        )}

        {visible.length === 0 && filter !== "all" ? (
          <p className="py-4 text-sm text-muted-foreground">
            {text("Geen onderdelen die bij dit filter passen.", "No items match this filter.")}
          </p>
        ) : (
          <div className="space-y-6">
            {dates
              .filter((day) => mode === "all" || day === focusedDay)
              .map((day) => {
                const dayEntries = visible.filter((entry) => entry.day === day);
                if (!dayEntries.length && filter !== "all") return null;
                const overview = tripDayOverview(trip, day);
                const collapsed = mode === "all" && collapsedDays.has(day);
                return (
                  <section key={day} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/25 p-3 text-xs">
                      <span className="font-medium">{text("Dagoverzicht", "Day overview")}</span>
                      <span>{overview.movements.length} {text("vervoersboekingen", "transport bookings")}</span>
                      <span>{overview.activities.length} {text("activiteiten", "activities")}</span>
                      {overview.stays.length > 0 && <span className="inline-flex items-center gap-1"><BedDouble className="size-3" />{overview.stays.map(item => item.title).join(" \u00b7 ")}</span>}
                      {overview.missingNight && <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onFindStay} disabled={!onFindStay}>{text("Overnachting ontbreekt: zoek verblijf", "Missing overnight stay: find accommodation")}</Button>}
                      {overview.missingTimes.length > 0 && <span>{text(`${overview.missingTimes.length} begintijden nog invullen`, `${overview.missingTimes.length} start times to add`)}</span>}
                      {overview.missingLocations.length > 0 && <span>{text(`${overview.missingLocations.length} vervoerslocaties nog invullen`, `${overview.missingLocations.length} transport locations to add`)}</span>}
                    </div>

                    {mode === "all" ? (
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={!collapsed}
                        aria-controls={`timeline-day-${day}`}
                        onClick={() => toggleDay(day)}
                      >
                        <span className="font-display text-base font-semibold capitalize">
                          {dateLabel(day, locale)}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          {dayEntries.length}{" "}
                          {dayEntries.length === 1
                            ? text("onderdeel", "item")
                            : text("onderdelen", "items")}
                          {collapsed ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronUp className="size-4" />
                          )}
                        </span>
                      </button>
                    ) : (
                      <h3 className="font-display text-base font-semibold capitalize">
                        {dateLabel(day, locale)}
                      </h3>
                    )}
                    {!dayEntries.length && <p className="text-sm text-muted-foreground">{text("Nog geen onderdelen gepland voor deze dag.", "No items planned for this day yet.")}</p>}
                    <div
                      id={`timeline-day-${day}`}
                      hidden={collapsed}
                      className="relative space-y-3 border-l border-border pl-5 before:absolute before:-left-1 before:top-1 before:size-2 before:rounded-full before:bg-primary"
                    >
                      {dayEntries.map((entry) => {
                        const Icon = icons[entry.kind];
                        const amount = !entry.phase || entry.phase === "start" ? entry.item?.amount : undefined;
                        return (
                          <article
                            key={entry.id}
                            className="relative rounded-xl border border-border bg-card p-3 shadow-sm"
                          >
                            <span className="absolute -left-[1.9rem] top-4 grid size-6 place-items-center rounded-full border border-border bg-background text-primary">
                              <Icon className="size-3.5" />
                            </span>
                            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                              <div className="min-w-0 flex-1 basis-60">
                                <p className="break-words font-medium">{entry.title}</p>
                                {(entry.subtitle || entry.item) && (
                                  <p className="mt-1 break-words text-xs text-muted-foreground">
                                    {entry.subtitle || detailFor(entry.item!, text)}
                                  </p>
                                )}
                              </div>
                              {entry.time && (
                                <Badge variant="outline">
                                  <Clock3 className="size-3" /> {entry.time}
                                </Badge>
                              )}
                              {amount ? (
                                <Badge variant="secondary">
                                  {formatMoney(amount, entry.item?.currency ?? baseCurrency)}
                                </Badge>
                              ) : null}
                              {((entry.manual && onUpdate) || (entry.item && onEditBooking)) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={saving}
                                  aria-label={text(
                                    `${entry.title} wijzigen`,
                                    `Edit ${entry.title}`,
                                  )}
                                  onClick={() => {
                                    if (entry.manual) setEditing({ ...entry.manual });
                                    else if (entry.item) onEditBooking?.(entry.item);
                                  }}
                                >
                                  <Pencil className="size-4" /> {text("Wijzigen", "Edit")}
                                </Button>
                              )}
                              {entry.manual && editable && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={text(
                                    "Verwijder programma-item",
                                    "Delete itinerary item",
                                  )}
                                  disabled={saving}
                                  onClick={() => void removeManualItem(entry.manual!.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                            {entry.item?.location && (
                              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3" /> {entry.item.location.name}
                              </p>
                            )}
                            {entry.item?.notes && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {entry.item.notes}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        )}
        {entries.some((entry) => entry.item?.amount) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CircleDollarSign className="size-3" />{" "}
            {text(
              "Kosten zijn gekoppeld aan het reisonderdeel en staan ook bij Uitgaven.",
              "Costs are linked to the travel item and also appear under Expenses.",
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
