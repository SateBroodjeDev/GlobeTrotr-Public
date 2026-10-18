import { useMemo, useState, type ReactNode } from "react";
import { Car, ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BookingCar } from "@/lib/booking-cars";
import { searchRentalCars } from "@/lib/car-search.functions";
import { normalizeTravelOption } from "@/lib/trip-options";
import type { Trip } from "@/lib/types";
import { uid } from "@/lib/workspace";
import { BOOKING_AFFILIATE_LINKS } from "@/lib/booking-affiliate";

type Text = (nl: string, en: string) => string;

export function RentalCarSearch({
  trip,
  editable,
  currency,
  save,
  text,
}: {
  trip: Trip;
  editable: boolean;
  currency: string;
  save: (fn: (trip: Trip) => Trip) => Promise<void>;
  text: Text;
}) {
  const first = trip.stops[0];
  const last = trip.stops.at(-1) ?? first;
  const [open, setOpen] = useState(false);
  const [pickupId, setPickupId] = useState(first?.id ?? "");
  const [dropoffId, setDropoffId] = useState(last?.id ?? "");
  const [pickupDate, setPickupDate] = useState(trip.start);
  const [dropoffDate, setDropoffDate] = useState(trip.end);
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [driverAge, setDriverAge] = useState("");
  const [passengers, setPassengers] = useState("");
  const [luggage, setLuggage] = useState("");
  const [results, setResults] = useState<BookingCar[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [transmission, setTransmission] = useState("all");
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const passengerCount = Number(passengers);
  const luggageCount = Number(luggage);

  const visibleResults = useMemo(() => {
    const priceLimit = Number(maxPrice) || Infinity;
    return results.filter(
      (car) =>
        (car.seats == null || car.seats >= passengerCount) &&
        (!luggageCount || car.baggage == null || car.baggage >= luggageCount) &&
        (transmission === "all" || car.transmission?.toLowerCase().includes(transmission)) &&
        (!freeCancellation || car.freeCancellation) &&
        (!maxPrice || (car.amount != null && car.amount <= priceLimit)),
    );
  }, [freeCancellation, luggageCount, maxPrice, passengerCount, results, transmission]);

  async function search() {
    const pickup = trip.stops.find((stop) => stop.id === pickupId);
    const dropoff = trip.stops.find((stop) => stop.id === dropoffId);
    const age = Number(driverAge);
    if (
      !pickup ||
      !dropoff ||
      !pickupDate ||
      !dropoffDate ||
      !pickupTime ||
      !dropoffTime ||
      !Number.isInteger(age) ||
      age < 20 ||
      age > 65 ||
      !Number.isInteger(passengerCount) ||
      passengerCount < 1 ||
      passengerCount > 9 ||
      !Number.isInteger(luggageCount) ||
      luggageCount < 0 ||
      luggageCount > 12
    ) {
      toast.error(
        text(
          "Vul alle zoekgegevens volledig en geldig in.",
          "Complete all search details with valid values.",
        ),
      );
      return;
    }
    setLoading(true);
    setSearched(false);
    setResults([]);
    try {
      const response = await searchRentalCars({
        data: {
          tripId: trip.id,
          pickupQuery: pickup.name,
          dropoffQuery: dropoff.name,
          pickupLat: pickup.lat,
          pickupLon: pickup.lon,
          dropoffLat: dropoff.lat,
          dropoffLon: dropoff.lon,
          pickupDate,
          dropoffDate,
          pickupTime,
          dropoffTime,
          driverAge: age,
          currency,
          language: text("nl", "en") as "nl" | "en",
        },
      });
      if ("errorCode" in response && response.errorCode) throw new Error(response.errorCode);
      setResults(response.results);
      setSearched(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = ["INVALID_CAR_SEARCH","CAR_SEARCH_RATE_LIMIT","BOOKING_CAR_NOT_CONFIGURED","BOOKING_CAR_QUOTA","BOOKING_CAR_AUTH","BOOKING_CAR_NO_RESULTS","BOOKING_CAR_INVALID_INPUT","BOOKING_CAR_TIMEOUT","BOOKING_CAR_UNAVAILABLE","BOOKING_CAR_RESPONSE_INVALID"].find((candidate) => message.includes(candidate)) ?? "";
      toast.error(
        code === "CAR_SEARCH_RATE_LIMIT"
          ? text(
              "Je zoekt te snel. Probeer het over een minuut opnieuw.",
              "You are searching too quickly. Try again in a minute.",
            )
          : code === "BOOKING_CAR_NOT_CONFIGURED"
            ? text(
                "Booking.com-huurauto's zijn nog niet op de server geconfigureerd.",
                "Booking.com rental cars are not configured on the server yet.",
              )
            : code === "BOOKING_CAR_QUOTA"
              ? text(
                  "De Booking.com API-limiet is bereikt.",
                  "The Booking.com API quota has been reached.",
                )
              : code === "BOOKING_CAR_AUTH"
                ? text(
                    "De Booking.com API-sleutel of het RapidAPI-abonnement is niet geldig.",
                    "The Booking.com API key or RapidAPI subscription is invalid.",
                  )
                : code === "BOOKING_CAR_RESPONSE_INVALID"
                  ? text("Het antwoord van de huurautoaanbieder kon niet worden verwerkt. Dit betekent niet dat er geen auto's beschikbaar zijn.", "The rental provider's response could not be processed. This does not mean no cars are available.")
                : code === "BOOKING_CAR_NO_RESULTS"
                  ? text(
                      "Booking.com vond geen beschikbare huurauto's voor deze plaats, tijden en bestuurdersleeftijd.",
                      "Booking.com found no available rental cars for this location, times and driver age.",
                    )
                  : code === "BOOKING_CAR_INVALID_INPUT" || code === "INVALID_CAR_SEARCH"
                    ? text(
                        "Booking.com kon deze combinatie van plaats, datum en tijd niet verwerken. Controleer de zoekgegevens.",
                        "Booking.com could not process this combination of location, date and time. Check the search details.",
                      )
                  : code === "BOOKING_CAR_TIMEOUT"
                    ? text(
                        "Booking.com antwoordde niet op tijd. Probeer het later opnieuw; er worden geen verouderde resultaten getoond.",
                        "Booking.com did not respond in time. Try again later; no stale results are shown.",
                      )
              : text(
                  "Huurauto's zoeken is tijdelijk niet beschikbaar.",
                  "Rental car search is temporarily unavailable.",
                ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function add(car: BookingCar) {
    setSaving(car.id);
    try {
      const pickup = trip.stops.find((stop) => stop.id === pickupId);
      const dropoff = trip.stops.find((stop) => stop.id === dropoffId);
      const notes = [
        car.transmission && `${text("Transmissie", "Transmission")}: ${car.transmission}`,
        car.seats && `${text("Zitplaatsen", "Seats")}: ${car.seats}`,
        car.baggage != null && `${text("Bagage", "Baggage")}: ${car.baggage}`,
        `${text("Reizigers", "Travellers")}: ${passengerCount}`,
        text(
          "Zoekprijs; controleer de definitieve prijs, dekking en voorwaarden bij Booking.com.",
          "Search price; verify the final price, coverage and terms at Booking.com.",
        ),
      ]
        .filter(Boolean)
        .join(" · ");
      const option = normalizeTravelOption({
        id: uid(),
        type: "car_rental",
        title: car.name,
        startDate: pickupDate,
        endDate: dropoffDate,
        provider: car.supplier || "Booking.com",
        amount: car.amount,
        currency: car.currency || currency,
        sourceUrl: car.sourceUrl,
        notes,
        cancellation: car.freeCancellation
          ? text(
              "Gratis annuleren volgens de actuele providerweergave; controleer de deadline bij Booking.com.",
              "Free cancellation according to the current provider result; verify the deadline at Booking.com.",
            )
          : undefined,
        status: "candidate",
        checkedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        details: {
          startTime: pickupTime,
          endTime: dropoffTime,
          departureName: car.pickupName || pickup?.name,
          arrivalName: car.dropoffName || dropoff?.name,
          vehicle: car.name,
          vehicleCategory: car.category,
          deposit: car.deposit,
        },
      });
      await save((current) => ({
        ...current,
        travelOptions: [...(current.travelOptions ?? []), option],
      }));
      toast.success(
        text("Huurauto toegevoegd aan de Vergelijker.", "Rental car added to Comparison."),
      );
    } catch {
      toast.error(text("Huurauto kon niet worden toegevoegd.", "Rental car could not be added."));
    } finally {
      setSaving(undefined);
    }
  }

  if (trip.stops.length === 0) return null;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="size-5" />
            {text("Huurauto zoeken", "Find a rental car")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {text(
              "Vul reizigers, bagage, plaatsen, datums, tijden en bestuurdersleeftijd in en vergelijk geschikte auto's.",
              "Enter travellers, luggage, locations, dates, times and driver age, then compare suitable cars.",
            )}
          </p>
          <Button disabled={!editable} onClick={() => setOpen(true)}>
            <Search className="size-4" />
            {text("Zoek huurauto's", "Search rental cars")}
          </Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{text("Huurauto zoeken", "Find a rental car")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {text(
              "Vul alle gegevens in. GlobeTrotr neemt geen personen, bagage of leeftijd voor je aan.",
              "Enter all details. GlobeTrotr does not assume passengers, luggage or age for you.",
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={text("Ophalen", "Pick up")}>
              <StopSelect value={pickupId} trip={trip} onChange={setPickupId} />
            </Field>
            <Field label={text("Inleveren", "Drop off")}>
              <StopSelect value={dropoffId} trip={trip} onChange={setDropoffId} />
            </Field>
            <Field label={text("Ophaaldatum", "Pick-up date")}>
              <Input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </Field>
            <Field label={text("Inleverdatum", "Drop-off date")}>
              <Input
                type="date"
                value={dropoffDate}
                onChange={(e) => setDropoffDate(e.target.value)}
              />
            </Field>
            <Field label={text("Ophaaltijd", "Pick-up time")}>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </Field>
            <Field label={text("Inlevertijd", "Drop-off time")}>
              <Input
                type="time"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
              />
            </Field>
            <Field label={text("Leeftijd bestuurder", "Driver age")}>
              <Input
                type="number"
                min={20}
                max={65}
                placeholder="30"
                value={driverAge}
                onChange={(e) => setDriverAge(e.target.value)}
              />
            </Field>
            <Field label={text("Aantal personen", "Passengers")}>
              <Input
                type="number"
                min={1}
                max={9}
                placeholder="2"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
              />
            </Field>
            <Field label={text("Aantal koffers", "Suitcases")}>
              <Input
                type="number"
                min={0}
                max={12}
                placeholder="1"
                value={luggage}
                onChange={(e) => setLuggage(e.target.value)}
              />
            </Field>
            <Button className="self-end" disabled={loading} onClick={() => void search()}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {text("Zoeken", "Search")}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={text("Transmissie", "Transmission")}>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value)}
                >
                  <option value="all">{text("Alle", "All")}</option>
                  <option value="automatic">{text("Automaat", "Automatic")}</option>
                  <option value="manual">{text("Handgeschakeld", "Manual")}</option>
                </select>
              </Field>
              <Field label={text("Max. totaalprijs", "Max total price")}>
                <Input
                  type="number"
                  min={0}
                  placeholder={text("Geen maximum", "No maximum")}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </Field>
              <label className="flex min-h-10 items-center gap-2 self-end rounded-md border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={freeCancellation}
                  onChange={(e) => setFreeCancellation(e.target.checked)}
                />
                {text("Gratis annuleren", "Free cancellation")}
              </label>
              <p className="self-end text-xs text-muted-foreground">
                {visibleResults.length} {text("van", "of")} {results.length}{" "}
                {text("resultaten", "results")}
              </p>
            </div>
          )}
          {searched && !loading && results.length === 0 && (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {text(
                "Geen huurauto's gevonden. Pas de zoekgegevens aan en probeer opnieuw.",
                "No rental cars found. Change the search details and try again.",
              )}
            </p>
          )}
          {results.length > 0 && visibleResults.length === 0 && (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {text(
                "Geen auto's passen bij alle filters. Verruim een filter.",
                "No cars match all filters. Widen a filter.",
              )}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {visibleResults.map((car) => (
              <CarResult
                key={car.id}
                car={car}
                currency={currency}
                saving={saving}
                editable={editable}
                pickup={trip.stops.find((s) => s.id === pickupId)?.name}
                dropoff={trip.stops.find((s) => s.id === dropoffId)?.name}
                text={text}
                onAdd={() => void add(car)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {text(
              "Een zoekresultaat is geen reservering. Controleer prijs, borg, verzekering, eigen risico en voorwaarden altijd bij de aanbieder. Boeken opent onze CJ-partnerlink; GlobeTrotr kan een commissie ontvangen.",
              "A search result is not a reservation. Always verify price, deposit, insurance, excess and terms with the provider. Book opens our CJ affiliate link; GlobeTrotr may receive a commission.",
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StopSelect({
  value,
  trip,
  onChange,
}: {
  value: string;
  trip: Trip;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border bg-background px-3"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {trip.stops.map((stop) => (
        <option key={stop.id} value={stop.id}>
          {stop.name}
        </option>
      ))}
    </select>
  );
}
function CarResult({
  car,
  currency,
  saving,
  editable,
  pickup,
  dropoff,
  text,
  onAdd,
}: {
  car: BookingCar;
  currency: string;
  saving?: string;
  editable: boolean;
  pickup?: string;
  dropoff?: string;
  text: Text;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border p-4">
      <strong>{car.name}</strong>
      <p className="text-sm text-muted-foreground">
        {[car.supplier, car.category, car.transmission].filter(Boolean).join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        {[
          car.seats && `${car.seats} ${text("zitplaatsen", "seats")}`,
          car.baggage != null && `${car.baggage} ${text("koffers", "suitcases")}`,
          car.freeCancellation && text("Gratis annuleren", "Free cancellation"),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {car.amount != null && (
        <p className="mt-2 font-semibold">
          {new Intl.NumberFormat(text("nl-NL", "en-GB"), {
            style: "currency",
            currency: car.currency || currency,
          }).format(car.amount)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {text("totaal", "total")}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {car.pickupName || pickup} → {car.dropoffName || dropoff}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={BOOKING_AFFILIATE_LINKS.cars} target="_blank" rel="sponsored noopener noreferrer">
            <ExternalLink className="size-4" />
            {text("Boeken", "Book")}
          </a>
        </Button>
        <Button size="sm" disabled={!editable || Boolean(saving)} onClick={onAdd}>
          {saving === car.id && <Loader2 className="size-4 animate-spin" />}
          {text("Naar Vergelijker", "Add to Comparison")}
        </Button>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
