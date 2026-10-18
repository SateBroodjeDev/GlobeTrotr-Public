import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Archive, Check, ExternalLink, GitCompareArrows, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TripOptionDiscussion } from "@/components/TripOptionDiscussion";
import { TripOptionPoll } from "@/components/TripOptionPoll";
import { RentalCarSearch } from "@/components/RentalCarSearch";
import { CURRENCIES, convert, formatMoney, type Rates } from "@/lib/services";
import {
  convertOptionToBooking,
  MAX_COMPARE_OPTIONS,
  normalizeTravelOption,
} from "@/lib/trip-options";
import type {
  TransportMode,
  Trip,
  TravelItemType,
  TravelOption,
  TravelOptionDetails,
} from "@/lib/types";
import { uid } from "@/lib/workspace";

type Text = (nl: string, en: string) => string;
type Draft = {
  title: string;
  type: TravelItemType;
  startDate: string;
  endDate: string;
  provider: string;
  amount: string;
  currency: string;
  chargesIncluded: boolean;
  cancellation: string;
  distanceKm: string;
  sourceUrl: string;
  notes: string;
  details: TravelOptionDetails;
};

const emptyDraft = (date: string): Draft => ({
  title: "",
  type: "lodging",
  startDate: date,
  endDate: "",
  provider: "",
  amount: "",
  currency: "EUR",
  chargesIncluded: false,
  cancellation: "",
  distanceKm: "",
  sourceUrl: "",
  notes: "",
  details: {},
});

export function TripOptions({
  trip,
  editable,
  base,
  rates,
  save,
  text,
}: {
  trip: Trip;
  editable: boolean;
  base: string;
  rates: Rates;
  save: (fn: (current: Trip) => Trip) => Promise<void>;
  text: Text;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(trip.start));
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TravelItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TravelOption["status"] | "all">("candidate");
  const [sortBy, setSortBy] = useState<
    "created" | "price" | "duration" | "distance" | "flexibility"
  >("created");
  const options = useMemo(() => trip.travelOptions ?? [], [trip.travelOptions]);
  const visibleOptions = useMemo(() => {
    const filtered = options.filter(
      (option) =>
        (typeFilter === "all" || option.type === typeFilter) &&
        (statusFilter === "all" || option.status === statusFilter),
    );
    return [...filtered].sort((left, right) => {
      if (sortBy === "created") return right.createdAt.localeCompare(left.createdAt);
      if (sortBy === "flexibility") {
        return Number(Boolean(right.cancellation)) - Number(Boolean(left.cancellation));
      }
      const field =
        sortBy === "price" ? "amount" : sortBy === "duration" ? "durationMinutes" : "distanceKm";
      return (left[field] ?? Number.POSITIVE_INFINITY) - (right[field] ?? Number.POSITIVE_INFINITY);
    });
  }, [options, sortBy, statusFilter, typeFilter]);
  const compared = useMemo(
    () => options.filter((item) => selected.includes(item.id)),
    [options, selected],
  );

  function detail<K extends keyof TravelOptionDetails>(key: K, value: TravelOptionDetails[K]) {
    setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  }

  async function add() {
    if (!draft.title.trim() || !draft.startDate) {
      toast.error(text("Naam en startdatum zijn verplicht.", "Name and start date are required."));
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      toast.error(
        text(
          "De einddatum kan niet vóór de startdatum liggen.",
          "The end date cannot be before the start date.",
        ),
      );
      return;
    }
    if (draft.type === "lodging" && (!draft.endDate || !draft.details.locationName?.trim() || !draft.details.guests || !draft.details.rooms)) {
      toast.error(text("Vul voor een verblijf bestemming, uitcheckdatum, gasten en kamers in.", "For accommodation, enter the destination, check-out date, guests and rooms."));
      return;
    }
    if (draft.amount && (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) < 0)) {
      toast.error(text("Vul een geldig bedrag in.", "Enter a valid amount."));
      return;
    }
    setBusy(true);
    try {
      const option = normalizeTravelOption({
        id: uid(),
        type: draft.type,
        title: draft.title,
        startDate: draft.startDate,
        endDate: draft.endDate || undefined,
        provider: draft.provider,
        amount: draft.amount ? Number(draft.amount) : undefined,
        currency: draft.currency,
        chargesIncluded: draft.chargesIncluded,
        cancellation: draft.cancellation,
        durationMinutes: timeDurationMinutes(draft.details.startTime, draft.details.endTime),
        distanceKm: draft.distanceKm ? Number(draft.distanceKm) : undefined,
        sourceUrl: draft.sourceUrl,
        notes: draft.notes,
        status: "candidate",
        checkedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        details: draft.details,
      });
      await save((current) => ({
        ...current,
        travelOptions: [...(current.travelOptions ?? []), option],
      }));
      setDraft(emptyDraft(trip.start));
      setDialogOpen(false);
      toast.success(text("Kandidaat toegevoegd.", "Candidate added."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Kandidaat kon niet worden opgeslagen.", "Candidate could not be saved."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: TravelOption["status"]) {
    if (!editable) return;
    setBusy(true);
    try {
      await save((current) => ({
        ...current,
        travelOptions: (current.travelOptions ?? []).map((item) =>
          item.id === id ? { ...item, status } : item,
        ),
      }));
      toast.success(
        status === "rejected"
          ? text("Kandidaat gearchiveerd.", "Candidate archived.")
          : text("Kandidaat bijgewerkt.", "Candidate updated."),
      );
    } catch {
      toast.error(text("Kandidaat kon niet worden bijgewerkt.", "Candidate could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !editable ||
      !confirm(text("Deze kandidaat definitief verwijderen?", "Permanently delete this candidate?"))
    )
      return;
    setBusy(true);
    try {
      await save((current) => ({
        ...current,
        travelOptions: (current.travelOptions ?? []).filter((item) => item.id !== id),
      }));
      setSelected((current) => current.filter((item) => item !== id));
      toast.success(text("Kandidaat verwijderd.", "Candidate deleted."));
    } catch {
      toast.error(text("Kandidaat kon niet worden verwijderd.", "Candidate could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  async function convertToBooking(id: string) {
    if (
      !editable ||
      !confirm(
        text(
          "Deze keuze omzetten naar een geboekt reisonderdeel?",
          "Convert this choice into a booked trip item?",
        ),
      )
    )
      return;
    setBusy(true);
    try {
      let changed = false;
      await save((current) => {
        const result = convertOptionToBooking(
          current.travelOptions ?? [],
          current.travelItems ?? [],
          id,
          uid,
        );
        changed = result.changed;
        return result.changed
          ? { ...current, travelOptions: result.options, travelItems: result.travelItems }
          : current;
      });
      toast.success(
        changed
          ? text("Kandidaat staat nu bij de boekingen.", "Candidate is now listed under bookings.")
          : text("Deze kandidaat was al omgezet.", "This candidate was already converted."),
      );
    } catch {
      toast.error(text("Kandidaat kon niet worden omgezet.", "Candidate could not be converted."));
    } finally {
      setBusy(false);
    }
  }

  function toggleCompare(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < MAX_COMPARE_OPTIONS
          ? [...current, id]
          : current,
    );
    if (!selected.includes(id) && selected.length >= MAX_COMPARE_OPTIONS)
      toast.error(text("Vergelijk maximaal vier kandidaten.", "Compare up to four candidates."));
  }

  return (
    <div className="space-y-5">
      <RentalCarSearch trip={trip} editable={editable} currency={base} save={save} text={text} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <GitCompareArrows className="size-5 text-primary" />
            {text("Reisvergelijker", "Trip comparison")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(
              "Vergelijk kandidaten per categorie. Pas je definitieve keuze wordt een boeking.",
              "Compare candidates by category. Only your final choice becomes a booking.",
            )}
          </p>
        </div>
        {editable && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            {text("Kandidaat toevoegen", "Add candidate")}
          </Button>
        )}
      </div>

      {!!options.length && (
        <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-3">
          <Field label={text("Filter op soort", "Filter by type")}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TravelItemType | "all")}
            >
              <option value="all">{text("Alle soorten", "All types")}</option>
              {typeEntries(text).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text("Status", "Status")}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TravelOption["status"] | "all")
              }
            >
              <option value="all">{text("Alle statussen", "All statuses")}</option>
              <option value="candidate">{text("Kandidaten", "Candidates")}</option>
              <option value="selected">{text("Gekozen", "Chosen")}</option>
              <option value="rejected">{text("Gearchiveerd", "Archived")}</option>
            </select>
          </Field>
          <Field label={text("Sorteren", "Sort by")}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            >
              <option value="created">{text("Nieuwste", "Newest")}</option>
              <option value="price">{text("Laagste prijs", "Lowest price")}</option>
              <option value="duration">{text("Kortste duur", "Shortest duration")}</option>
              <option value="distance">{text("Kortste afstand", "Shortest distance")}</option>
              <option value="flexibility">
                {text("Annuleringsinformatie", "Cancellation information")}
              </option>
            </select>
          </Field>
        </div>
      )}

      {!options.length ? (
        <Card className="surface">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {text(
              "Nog geen kandidaten. Voeg bijvoorbeeld twee hotels of vluchten toe om ze te vergelijken.",
              "No candidates yet. Add two hotels or flights to compare them.",
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleOptions.map((option) => (
            <OptionCard
              key={option.id}
              tripId={trip.id}
              option={option}
              selected={selected.includes(option.id)}
              disabled={busy}
              editable={editable}
              base={base}
              rates={rates}
              text={text}
              onCompare={() => toggleCompare(option.id)}
              onArchive={() => void setStatus(option.id, "rejected")}
              onDelete={() => void remove(option.id)}
              onConvert={() => void convertToBooking(option.id)}
            />
          ))}
          {!visibleOptions.length && (
            <Card className="surface md:col-span-2 xl:col-span-3">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {text(
                  "Geen kandidaten passen bij deze filters.",
                  "No candidates match these filters.",
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {compared.length >= 2 && (
        <Comparison options={compared} base={base} rates={rates} text={text} />
      )}

      <TripOptionPoll tripId={trip.id} options={options} editable={editable} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{text("Kandidaat toevoegen", "Add candidate")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.type === "lodging" && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm sm:col-span-2"><strong>{text("Vergelijk dezelfde zoekvraag", "Compare the same search brief")}</strong><p className="mt-1 text-muted-foreground">{text("Gebruik voor alle kandidaten dezelfde bestemming, datums, gasten en kamers. Vul de volledige verblijfsprijs in en noteer belastingen en voorwaarden afzonderlijk.", "Use the same destination, dates, guests and rooms for every candidate. Enter the complete stay price and record taxes and terms separately.")}</p></div>}
            <Field label={text("Soort", "Type")}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.type}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    type: e.target.value as TravelItemType,
                    distanceKm: "",
                    details: {},
                  }))
                }
              >
                {typeEntries(text).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={text("Naam", "Name")}>
              <Input
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label={dateLabel(draft.type, "start", text)}>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </Field>
            <Field label={dateLabel(draft.type, "end", text)}>
              <Input
                type="date"
                min={draft.startDate}
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </Field>
            <Field label={text("Aanbieder", "Provider")}>
              <Input
                maxLength={120}
                value={draft.provider}
                onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field label={text("Totaalprijs", "Total price")}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </Field>
              <Field label={text("Valuta", "Currency")}>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <TypeSpecificFields draft={draft} setDraft={setDraft} detail={detail} text={text} />
            <Field
              label={text("Annuleringsvoorwaarden", "Cancellation terms")}
              className="sm:col-span-2"
            >
              <Input
                maxLength={500}
                value={draft.cancellation}
                onChange={(e) => setDraft({ ...draft, cancellation: e.target.value })}
              />
            </Field>
            <Field label={text("Bronlink", "Source link")} className="sm:col-span-2">
              <Input
                type="url"
                placeholder="https://"
                value={draft.sourceUrl}
                onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              />
            </Field>
            <Field label={text("Notities", "Notes")} className="sm:col-span-2">
              <Textarea
                rows={4}
                maxLength={2000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.chargesIncluded}
                onChange={(e) => setDraft({ ...draft, chargesIncluded: e.target.checked })}
              />
              {text(
                "Bekende belastingen en toeslagen zijn inbegrepen",
                "Known taxes and charges are included",
              )}
            </label>
            <Button className="sm:col-span-2" disabled={busy} onClick={() => void add()}>
              {busy ? text("Opslaan…", "Saving…") : text("Kandidaat opslaan", "Save candidate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeSpecificFields({
  draft,
  setDraft,
  detail,
  text,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  detail: <K extends keyof TravelOptionDetails>(key: K, value: TravelOptionDetails[K]) => void;
  text: Text;
}) {
  const moving =
    draft.type === "flight" || draft.type === "transport" || draft.type === "car_rental";
  return (
    <div className="grid gap-4 rounded-xl border bg-muted/20 p-3 sm:col-span-2 sm:grid-cols-2">
      {draft.type === "flight" && (
        <Field label={text("Vluchtnummer", "Flight number")}>
          <Input
            maxLength={24}
            placeholder="KL1234"
            value={draft.details.flightNumber ?? ""}
            onChange={(event) => detail("flightNumber", event.target.value)}
          />
        </Field>
      )}
      {draft.type === "transport" && (
        <Field label={text("Vervoerssoort", "Mode of transport")}>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draft.details.transportMode ?? ""}
            onChange={(event) =>
              detail(
                "transportMode",
                (event.target.value || undefined) as TransportMode | undefined,
              )
            }
          >
            <option value="">{text("Kies vervoerssoort", "Choose transport mode")}</option>
            {transportModes(text).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {moving ? (
        <>
          <Field
            label={
              draft.type === "car_rental"
                ? text("Ophaallocatie", "Collection location")
                : text("Vertrek", "Departure")
            }
          >
            <Input
              maxLength={160}
              value={draft.details.departureName ?? ""}
              onChange={(event) => detail("departureName", event.target.value)}
            />
          </Field>
          <Field
            label={
              draft.type === "car_rental"
                ? text("Inleverlocatie", "Return location")
                : text("Aankomst", "Arrival")
            }
          >
            <Input
              maxLength={160}
              value={draft.details.arrivalName ?? ""}
              onChange={(event) => detail("arrivalName", event.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field label={text("Locatie", "Location")}>
          <Input
            maxLength={160}
            value={draft.details.locationName ?? ""}
            onChange={(event) => detail("locationName", event.target.value)}
          />
        </Field>
      )}
      <Field label={timeLabel(draft.type, "start", text)}>
        <Input
          type="time"
          value={draft.details.startTime ?? ""}
          onChange={(event) => detail("startTime", event.target.value)}
        />
      </Field>
      <Field label={timeLabel(draft.type, "end", text)}>
        <Input
          type="time"
          value={draft.details.endTime ?? ""}
          onChange={(event) => detail("endTime", event.target.value)}
        />
      </Field>
      {(draft.type === "flight" || draft.type === "transport" || draft.type === "car_rental") && (
        <Field label={text("Afstand in km", "Distance in km")}>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={draft.distanceKm}
            onChange={(event) =>
              setDraft((current) => ({ ...current, distanceKm: event.target.value }))
            }
          />
        </Field>
      )}
      {draft.type === "flight" && (
        <CheckField
          checked={Boolean(draft.details.luggageIncluded)}
          onChange={(checked) => detail("luggageIncluded", checked)}
          label={text("Ruimbagage inbegrepen", "Checked baggage included")}
        />
      )}
      {draft.type === "lodging" && (
        <>
          <Field label={text("Bestemming", "Destination")}>
            <Input maxLength={160} value={draft.details.locationName ?? ""} onChange={(event) => detail("locationName", event.target.value)} />
          </Field>
          <Field label={text("Kamertype", "Room type")}>
            <Input
              maxLength={120}
              value={draft.details.roomType ?? ""}
              onChange={(event) => detail("roomType", event.target.value)}
            />
          </Field>
          <NumberField
            label={text("Aantal gasten", "Number of guests")}
            value={draft.details.guests}
            onChange={(value) => detail("guests", value)}
            min={1}
          />
          <NumberField label={text("Aantal kamers", "Number of rooms")} value={draft.details.rooms} onChange={(value) => detail("rooms", value)} min={1} />
          <NumberField label={text("Belastingen en toeslagen", "Taxes and fees")} value={draft.details.taxesAndFees} onChange={(value) => detail("taxesAndFees", value)} min={0} />
          <CheckField
            checked={Boolean(draft.details.breakfastIncluded)}
            onChange={(checked) => detail("breakfastIncluded", checked)}
            label={text("Ontbijt inbegrepen", "Breakfast included")}
          />
        </>
      )}
      {draft.type === "car_rental" && (
        <>
          <Field label={text("Auto", "Vehicle")}>
            <Input
              maxLength={120}
              value={draft.details.vehicle ?? ""}
              onChange={(event) => detail("vehicle", event.target.value)}
            />
          </Field>
          <Field label={text("Categorie", "Category")}>
            <Input
              maxLength={80}
              value={draft.details.vehicleCategory ?? ""}
              onChange={(event) => detail("vehicleCategory", event.target.value)}
            />
          </Field>
          <Field label={text("Verzekering", "Insurance")}>
            <Input
              maxLength={160}
              value={draft.details.insurance ?? ""}
              onChange={(event) => detail("insurance", event.target.value)}
            />
          </Field>
          <NumberField
            label={text("Borg", "Deposit")}
            value={draft.details.deposit}
            onChange={(value) => detail("deposit", value)}
            min={0}
          />
          <NumberField
            label={text("Eigen risico", "Excess")}
            value={draft.details.excess}
            onChange={(value) => detail("excess", value)}
            min={0}
          />
        </>
      )}
      {draft.type === "activity" && (
        <>
          <Field label={text("Soort activiteit", "Activity type")}>
            <Input
              maxLength={100}
              value={draft.details.activityCategory ?? ""}
              onChange={(event) => detail("activityCategory", event.target.value)}
            />
          </Field>
          <NumberField
            label={text("Aantal deelnemers", "Participants")}
            value={draft.details.participants}
            onChange={(value) => detail("participants", value)}
            min={1}
          />
        </>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value?: number;
  min: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number(event.target.value))
        }
      />
    </Field>
  );
}

function CheckField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 self-end text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function timeLabel(type: TravelItemType, end: "start" | "end", text: Text) {
  if (type === "lodging")
    return end === "start"
      ? text("Inchecktijd", "Check-in time")
      : text("Uitchecktijd", "Check-out time");
  if (type === "car_rental")
    return end === "start"
      ? text("Ophaaltijd", "Collection time")
      : text("Inlevertijd", "Return time");
  if (type === "activity")
    return end === "start" ? text("Begintijd", "Start time") : text("Eindtijd", "End time");
  return end === "start"
    ? text("Vertrektijd", "Departure time")
    : text("Aankomsttijd", "Arrival time");
}

function dateLabel(type: TravelItemType, end: "start" | "end", text: Text) {
  if (type === "lodging")
    return end === "start"
      ? text("Incheckdatum", "Check-in date")
      : text("Uitcheckdatum", "Check-out date");
  if (type === "car_rental")
    return end === "start"
      ? text("Ophaaldatum", "Collection date")
      : text("Inleverdatum", "Return date");
  return end === "start" ? text("Startdatum", "Start date") : text("Einddatum", "End date");
}

function timeDurationMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const difference = endHour * 60 + endMinute - startHour * 60 - startMinute;
  return difference > 0 ? difference : undefined;
}

function transportModes(text: Text): [TransportMode, string][] {
  return [
    ["train", text("Trein", "Train")],
    ["bus", "Bus"],
    ["public_transport", text("Openbaar vervoer", "Public transport")],
    ["ferry", text("Veerboot", "Ferry")],
    ["taxi", "Taxi"],
    ["car", text("Auto", "Car")],
    ["motorcycle", text("Motor", "Motorcycle")],
    ["camper", "Camper"],
    ["bicycle", text("Fiets", "Bicycle")],
    ["walking", text("Lopen", "Walking")],
    ["other", text("Anders", "Other")],
  ];
}

function OptionCard({
  tripId,
  option,
  selected,
  disabled,
  editable,
  base,
  rates,
  text,
  onCompare,
  onArchive,
  onDelete,
  onConvert,
}: {
  tripId: string;
  option: TravelOption;
  selected: boolean;
  disabled: boolean;
  editable: boolean;
  base: string;
  rates: Rates;
  text: Text;
  onCompare: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const amount =
    option.amount == null
      ? undefined
      : convert(option.amount, option.currency ?? base, base, rates);
  return (
    <Card className={`surface ${selected ? "ring-2 ring-primary" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="break-anywhere text-base">{option.title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {typeLabel(option.type, text)} · {option.startDate}
              {option.endDate ? ` → ${option.endDate}` : ""}
            </p>
          </div>
          <Badge variant={option.status === "selected" ? "default" : "outline"}>
            {statusLabel(option.status, text)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label={text("Totaalprijs", "Total price")}
            value={amount == null ? "—" : formatMoney(amount, base)}
          />
          <Metric
            label={text("Toeslagen", "Charges")}
            value={
              option.chargesIncluded ? text("Inbegrepen", "Included") : text("Onbekend", "Unknown")
            }
          />
          {option.type !== "lodging" && option.type !== "activity" && (
            <>
              <Metric
                label={text("Reistijd", "Travel time")}
                value={option.durationMinutes ? formatDuration(option.durationMinutes) : "—"}
              />
              <Metric
                label={text("Afstand", "Distance")}
                value={option.distanceKm == null ? "—" : `${option.distanceKm} km`}
              />
            </>
          )}
        </div>
        <OptionDetails option={option} text={text} />
        {option.provider && (
          <p className="break-anywhere text-muted-foreground">
            {text("Aanbieder", "Provider")}: {option.provider}
          </p>
        )}
        {option.cancellation && (
          <p className="break-anywhere text-muted-foreground">
            {text("Annulering", "Cancellation")}: {option.cancellation}
          </p>
        )}
        {option.sourceUrl && (
          <a
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            href={option.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text("Bron openen", "Open source")}
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={onCompare}
          >
            <GitCompareArrows className="size-4" />
            {selected ? text("Geselecteerd", "Selected") : text("Vergelijken", "Compare")}
          </Button>
          {editable && !option.convertedTravelItemId && option.status !== "rejected" && (
            <Button type="button" size="sm" onClick={onConvert} disabled={disabled}>
              <Check className="size-4" />
              {text("Kiezen", "Choose")}
            </Button>
          )}
          {editable && option.status !== "rejected" && !option.convertedTravelItemId && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={text("Archiveren", "Archive")}
              onClick={onArchive}
              disabled={disabled}
            >
              <Archive className="size-4" />
            </Button>
          )}
          {editable && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={text("Verwijderen", "Delete")}
              onClick={onDelete}
              disabled={disabled}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        <TripOptionDiscussion tripId={tripId} optionId={option.id} />
      </CardContent>
    </Card>
  );
}

function Comparison({
  options,
  base,
  rates,
  text,
}: {
  options: TravelOption[];
  base: string;
  rates: Rates;
  text: Text;
}) {
  return (
    <Card className="surface">
      <CardHeader>
        <CardTitle className="text-base">{text("Vergelijking", "Comparison")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {options.map((option) => {
            const amount =
              option.amount == null
                ? undefined
                : convert(option.amount, option.currency ?? base, base, rates);
            return (
              <div key={option.id} className="rounded-xl border p-4">
                <p className="break-anywhere font-semibold">{option.title}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row
                    label={text("Prijs", "Price")}
                    value={amount == null ? "—" : formatMoney(amount, base)}
                  />
                  <Row
                    label={text("Toeslagen", "Charges")}
                    value={
                      option.chargesIncluded
                        ? text("Inbegrepen", "Included")
                        : text("Onbekend", "Unknown")
                    }
                  />
                  {option.type !== "lodging" && option.type !== "activity" && (
                    <>
                      <Row
                        label={text("Reistijd", "Travel time")}
                        value={
                          option.durationMinutes ? formatDuration(option.durationMinutes) : "—"
                        }
                      />
                      <Row
                        label={text("Afstand", "Distance")}
                        value={option.distanceKm == null ? "—" : `${option.distanceKm} km`}
                      />
                    </>
                  )}
                  <Row
                    label={text("Annulering", "Cancellation")}
                    value={option.cancellation || "—"}
                  />
                </dl>
                <OptionDetails option={option} text={text} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`space-y-1 text-sm ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="break-anywhere">{value}</strong>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-anywhere">{value}</dd>
    </div>
  );
}
function OptionDetails({ option, text }: { option: TravelOption; text: Text }) {
  const details = option.details;
  if (!details) return null;
  const rows: [string, string | undefined][] = [
    [
      text("Vluchtnummer", "Flight number"),
      option.type === "flight" ? details.flightNumber : undefined,
    ],
    [
      text("Route", "Route"),
      details.departureName && details.arrivalName
        ? `${details.departureName} → ${details.arrivalName}`
        : undefined,
    ],
    [text("Locatie", "Location"), details.locationName],
    [text("Kamertype", "Room type"), details.roomType],
    [text("Gasten", "Guests"), details.guests?.toString()],
    [text("Kamers", "Rooms"), details.rooms?.toString()],
    [text("Belastingen en toeslagen", "Taxes and fees"), details.taxesAndFees == null ? undefined : `${option.currency ?? ""} ${details.taxesAndFees.toFixed(2)}`.trim()],
    [
      text("Ontbijt", "Breakfast"),
      details.breakfastIncluded === undefined
        ? undefined
        : details.breakfastIncluded
          ? text("Inbegrepen", "Included")
          : text("Niet inbegrepen", "Not included"),
    ],
    [
      text("Ruimbagage", "Checked baggage"),
      details.luggageIncluded === undefined
        ? undefined
        : details.luggageIncluded
          ? text("Inbegrepen", "Included")
          : text("Niet inbegrepen", "Not included"),
    ],
    [text("Auto", "Vehicle"), details.vehicle],
    [text("Categorie", "Category"), details.vehicleCategory ?? details.activityCategory],
    [text("Borg", "Deposit"), details.deposit?.toString()],
    [text("Eigen risico", "Excess"), details.excess?.toString()],
    [text("Verzekering", "Insurance"), details.insurance],
    [text("Deelnemers", "Participants"), details.participants?.toString()],
    [
      text("Tijden", "Times"),
      details.startTime && details.endTime
        ? `${details.startTime} – ${details.endTime}`
        : (details.startTime ?? details.endTime),
    ],
  ];
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (!visible.length) return null;
  return (
    <dl className="space-y-1 text-sm text-muted-foreground">
      {visible.map(([label, value]) => (
        <Row key={label} label={label} value={value} />
      ))}
    </dl>
  );
}
function formatDuration(minutes: number) {
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)}u ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim();
}
function typeEntries(text: Text): [TravelItemType, string][] {
  return [
    ["lodging", text("Verblijf", "Accommodation")],
    ["flight", text("Vlucht", "Flight")],
    ["transport", text("Trein, bus of vervoer", "Train, bus or transport")],
    ["car_rental", text("Huurauto", "Rental car")],
    ["activity", text("Activiteit", "Activity")],
  ];
}
function typeLabel(type: TravelItemType, text: Text) {
  return typeEntries(text).find(([value]) => value === type)?.[1] ?? type;
}
function statusLabel(status: TravelOption["status"], text: Text) {
  return status === "selected"
    ? text("Gekozen", "Chosen")
    : status === "rejected"
      ? text("Gearchiveerd", "Archived")
      : text("Kandidaat", "Candidate");
}
