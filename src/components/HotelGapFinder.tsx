import { useId, useMemo, useState } from "react";
import { BedDouble, ExternalLink, Loader2, MapPin, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createHotelGapBooking,
  findTripHotelGaps,
  hotelGapSearchPeriod,
  type HotelGap,
  type TripHotelGap,
} from "@/lib/hotel-gaps";
import { searchNearbyHotels, type HotelSearchResult } from "@/lib/hotel-search.functions";
import { bookingHotelPartnerUrl } from "@/lib/booking-affiliate";
import { normalizeTravelOption } from "@/lib/trip-options";
import type { Trip } from "@/lib/types";
import { uid } from "@/lib/workspace";

type Text = (nl: string, en: string) => string;
type Props = {
  trip: Trip;
  editable: boolean;
  save: (fn: (trip: Trip) => Trip) => Promise<void>;
  text: Text;
};

export function HotelGapFinder({ trip, editable, save, text }: Props) {
  const gaps = useMemo(() => findTripHotelGaps(trip), [trip]);
  const tripNights = useMemo(() => {
    const start = Date.parse(`${trip.start}T00:00:00Z`),
      end = Date.parse(`${trip.end}T00:00:00Z`);
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? Math.min(366, Math.floor((end - start) / 86_400_000))
      : 0;
  }, [trip.start, trip.end]);
  const missingNights = gaps.reduce((sum, item) => sum + item.nights, 0);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [locationEditors, setLocationEditors] = useState<Record<string, boolean>>({});
  const [stayNights, setStayNights] = useState<Record<string, string>>({});
  const [gap, setGap] = useState<HotelGap>();
  const [results, setResults] = useState<HotelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [bookingResult, setBookingResult] = useState<HotelSearchResult>();
  const [bookingReference, setBookingReference] = useState("");
  const [adults, setAdults] = useState<number | "">("");
  const [rooms, setRooms] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [maxDistance, setMaxDistance] = useState("15");
  const [sortBy, setSortBy] = useState<"recommended" | "price" | "rating" | "distance">(
    "recommended",
  );
  const [searchProvider, setSearchProvider] = useState<"booking" | "openstreetmap">();

  function openSearch(item: TripHotelGap) {
    let period;
    try {
      period = hotelGapSearchPeriod(item, Number(stayNights[`${item.id}:${item.endDate}`] ?? Math.min(60, item.nights)));
    } catch {
      toast.error(text("Kies een geldig aantal nachten voor dit verblijf.", "Choose a valid number of nights for this stay."));
      return;
    }
    const stopId = locations[item.id] ?? item.suggestedStopId;
    const stop = trip.stops.find((candidate) => candidate.id === stopId);
    const location = stop ?? item.suggestedLocation;
    if (!location) {
      toast.error(
        text("Kies eerst waar je wilt overnachten.", "First choose where you want to stay."),
      );
      return;
    }
    setGap({
      ...item,
      ...period,
      stopId: stop?.id ?? `booking:${item.id}`,
      stopName: location.name,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
    });
    setResults([]);
    setSearchProvider(undefined);
  }

  async function search() {
    if (!gap) return;
    const guestCount = Number(adults);
    const roomCount = Number(rooms);
    if (
      !Number.isInteger(guestCount) ||
      guestCount < 1 ||
      guestCount > 20 ||
      !Number.isInteger(roomCount) ||
      roomCount < 1 ||
      roomCount > 10
    ) {
      toast.error(
        text(
          "Vul eerst het aantal gasten en kamers in.",
          "Enter the number of guests and rooms first.",
        ),
      );
      return;
    }
    setLoading(true);
    try {
      const found = await searchNearbyHotels({
        data: {
          tripId: trip.id,
          lat: gap.lat,
          lon: gap.lon,
          arrivalDate: gap.startDate,
          departureDate: gap.endDate,
          adults: guestCount,
          rooms: roomCount,
          currency: "EUR",
          language: text("nl", "en") as "nl" | "en",
        },
      });
      setResults(found.results);
      setSearchProvider(found.provider);
      if (found.provider === "openstreetmap") {
        toast.info(found.bookingStatus === "no_results"
          ? text("Booking.com vond geen beschikbaarheid. Je ziet alleen kaartlocaties zonder prijs- of beschikbaarheidscontrole.", "Booking.com found no availability. You only see map locations without price or availability verification.")
          : found.bookingStatus === "timeout"
            ? text("Booking.com antwoordde niet op tijd. Je ziet alleen kaartlocaties zonder prijs- of beschikbaarheidscontrole.", "Booking.com did not respond in time. You only see map locations without price or availability verification.")
            : text("Booking.com is tijdelijk niet bereikbaar. Je ziet alleen kaartlocaties zonder prijs- of beschikbaarheidscontrole.", "Booking.com is temporarily unavailable. You only see map locations without price or availability verification."));
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "HOTEL_SEARCH_RATE_LIMIT"
          ? text(
              "Je zoekt te snel. Probeer het over een minuut opnieuw.",
              "You are searching too quickly. Try again in a minute.",
            )
          : code === "BOOKING_HOTEL_AUTH"
            ? text(
                "De Booking.com API-sleutel of het RapidAPI-abonnement is niet geldig.",
                "The Booking.com API key or RapidAPI subscription is invalid.",
              )
            : code === "BOOKING_HOTEL_QUOTA"
              ? text(
                  "De Booking.com API-limiet is bereikt.",
                  "The Booking.com API quota has been reached.",
                )
              : code === "BOOKING_HOTEL_INVALID_INPUT"
                ? text(
                    "Booking.com kon deze combinatie van locatie, datums, gasten en kamers niet verwerken. Controleer de zoekgegevens.",
                    "Booking.com could not process this combination of location, dates, guests and rooms. Check the search details.",
                  )
              : code === "BOOKING_HOTEL_TIMEOUT"
                ? text(
                    "Booking.com antwoordde niet op tijd. GlobeTrotr toont daarom alleen kaartresultaten zonder prijscontrole.",
                    "Booking.com did not respond in time. GlobeTrotr therefore only shows map results without price verification.",
                  )
              : text(
                  "Hotels zoeken is tijdelijk niet beschikbaar.",
                  "Hotel search is temporarily unavailable.",
                ),
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleResults = useMemo(() => {
    const priceLimit = Number(maxPrice) || Number.POSITIVE_INFINITY;
    const ratingLimit = Number(minRating) || 0;
    const distanceLimit = Number(maxDistance) || 15;
    const filtered = results.filter(
      (result) =>
        (!maxPrice || (result.amount != null && result.amount <= priceLimit)) &&
        (!ratingLimit || (result.reviewScore != null && result.reviewScore >= ratingLimit)) &&
        result.distanceKm <= distanceLimit,
    );
    if (sortBy === "price")
      return [...filtered].sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity));
    if (sortBy === "rating")
      return [...filtered].sort((a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1));
    if (sortBy === "distance") return [...filtered].sort((a, b) => a.distanceKm - b.distanceKm);
    return filtered;
  }, [maxDistance, maxPrice, minRating, results, sortBy]);

  async function addCandidate(result: HotelSearchResult) {
    if (!gap) return;
    setSaving(result.id);
    try {
      const option = normalizeTravelOption({
        id: uid(),
        type: "lodging",
        title: result.name,
        startDate: gap.startDate,
        endDate: gap.endDate,
        provider: result.provider === "booking" ? "Booking.com" : "OpenStreetMap",
        amount: result.amount,
        currency: result.currency,
        distanceKm: result.distanceKm,
        sourceUrl: result.website ?? result.osmUrl,
        notes:
          result.provider === "booking"
            ? text(
                "Actuele zoekprijs voor de volledige verblijfsperiode; controleer de definitieve prijs en voorwaarden bij Booking.com.",
                "Current search price for the complete stay; verify the final price and terms at Booking.com.",
              )
            : text(
                "Kaartresultaat zonder live prijs of beschikbaarheid.",
                "Map result without live price or availability.",
              ),
        details: {
          locationName: `${gap.stopName}, ${gap.country}`,
          guests: Number(adults),
          rooms: Number(rooms),
          taxesAndFees: result.taxesAndFees,
        },
        status: "candidate",
        checkedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      await save((current) => ({
        ...current,
        travelOptions: [...(current.travelOptions ?? []), option],
      }));
      toast.success(
        text(
          "Kandidaat toegevoegd. Zet hem na het boeken in de Vergelijker om naar een boeking.",
          "Candidate added. After booking, convert it to a booking in Comparison.",
        ),
      );
    } catch {
      toast.error(text("Hotel kon niet worden toegevoegd.", "Hotel could not be added."));
    } finally {
      setSaving(undefined);
    }
  }

  async function confirmBooking() {
    if (!gap || !bookingResult) return;
    setSaving(bookingResult.id);
    try {
      const booking = createHotelGapBooking({
        id: uid(),
        name: bookingResult.name,
        startDate: gap.startDate,
        endDate: gap.endDate,
        location: { name: gap.stopName, country: gap.country, lat: gap.lat, lon: gap.lon },
        provider: bookingResult.provider === "booking" ? "Booking.com" : bookingResult.name,
        bookingReference,
        sourceUrl: bookingResult.website ?? bookingResult.osmUrl,
        amount: bookingResult.amount,
        currency: bookingResult.currency,
        note: text(
          "Extern geboekt; controleer de boekingsgegevens in het reisschema.",
          "Booked externally; verify the booking details in the itinerary.",
        ),
      });
      await save((current) => ({
        ...current,
        travelItems: [...(current.travelItems ?? []), booking],
      }));
      setBookingResult(undefined);
      setBookingReference("");
      setGap(undefined);
      toast.success(
        text(
          "Verblijfsboeking toegevoegd. De hotelcontrole is direct bijgewerkt.",
          "Accommodation booking added. The accommodation check has been updated.",
        ),
      );
    } catch {
      toast.error(
        text(
          "Verblijfsboeking kon niet worden toegevoegd.",
          "Accommodation booking could not be added.",
        ),
      );
    } finally {
      setSaving(undefined);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BedDouble className="size-5" />
            {text("Hotelcontrole en zoeken", "Accommodation check and search")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {text(
              "GlobeTrotr controleert iedere nacht. Bij een ontbrekend verblijf stellen we de waarschijnlijkste routeplaats voor.",
              "GlobeTrotr checks every night. For a missing stay, we suggest the most likely route location.",
            )}
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <Stat label={text("Reisnachten", "Trip nights")} value={tripNights} />
            <Stat
              label={text("Gedekte nachten", "Covered nights")}
              value={Math.max(0, tripNights - missingNights)}
            />
            <Stat label={text("Ontbrekende nachten", "Missing nights")} value={missingNights} />
          </div>
          {tripNights === 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              {text(
                "Stel eerst een geldige start- en einddatum in.",
                "Set a valid start and end date first.",
              )}
            </p>
          )}
          {tripNights > 0 && gaps.length === 0 && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              {text(
                "Alle reisnachten worden door een verblijfsboeking gedekt.",
                "Every trip night is covered by an accommodation booking.",
              )}
            </p>
          )}
          {gaps.map((item) => (
            <GapRow
              key={item.id}
              item={item}
              trip={trip}
              editable={editable}
              loading={loading}
              selected={locations[item.id] ?? item.suggestedStopId ?? ""}
              editing={Boolean(locationEditors[item.id])}
              text={text}
              onSelect={(value) => setLocations((current) => ({ ...current, [item.id]: value }))}
              onEdit={() => setLocationEditors((current) => ({ ...current, [item.id]: true }))}
              onSearch={() => openSearch(item)}
              nights={stayNights[`${item.id}:${item.endDate}`] ?? String(Math.min(60, item.nights))}
              onNightsChange={(value) => setStayNights((current) => ({ ...current, [`${item.id}:${item.endDate}`]: value }))}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            {text(
              "Een zoekresultaat is nog geen boeking. Controleer prijs en beschikbaarheid altijd bij de aanbieder.",
              "A search result is not a booking. Always verify price and availability with the provider.",
            )}
          </p>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(gap && !bookingResult)}
        onOpenChange={(open) => {
          if (!open && !bookingResult) setGap(undefined);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {text("Verblijven rond", "Accommodation near")} {gap?.stopName}
            </DialogTitle>
          </DialogHeader>
          {gap && (
            <>
              <p className="text-sm text-muted-foreground">
                {gap.startDate} – {gap.endDate} · {gap.nights}{" "}
                {gap.nights === 1 ? text("nacht", "night") : text("nachten", "nights")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{text("Gasten", "Guests")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={adults}
                    placeholder="2"
                    onChange={(event) =>
                      setAdults(
                        event.target.value === ""
                          ? ""
                          : Math.max(1, Math.min(20, Number(event.target.value))),
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{text("Kamers", "Rooms")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={rooms}
                    placeholder="1"
                    onChange={(event) =>
                      setRooms(
                        event.target.value === ""
                          ? ""
                          : Math.max(1, Math.min(10, Number(event.target.value))),
                      )
                    }
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button disabled={loading} onClick={() => void search()}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  {text("Zoek met deze gegevens", "Search with these details")}
                </Button>
              </div>
              {results.length > 0 && (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">{text("Sorteren", "Sort")}</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                    >
                      <option value="recommended">{text("Volgorde van aanbieder", "Provider order")}</option>
                      <option value="price">{text("Laagste prijs", "Lowest price")}</option>
                      <option value="rating">{text("Beste beoordeling", "Best rating")}</option>
                      <option value="distance">{text("Dichtstbij", "Nearest")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {text("Max. totaalprijs", "Max total price")}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      placeholder={text("Geen maximum", "No maximum")}
                      value={maxPrice}
                      onChange={(event) => setMaxPrice(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">{text("Min. beoordeling", "Min rating")}</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={minRating}
                      onChange={(event) => setMinRating(event.target.value)}
                    >
                      <option value="0">{text("Alle", "All")}</option>
                      <option value="7">7+</option>
                      <option value="8">8+</option>
                      <option value="9">9+</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">{text("Afstand", "Distance")}</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={maxDistance}
                      onChange={(event) => setMaxDistance(event.target.value)}
                    >
                      <option value="2">2 km</option>
                      <option value="5">5 km</option>
                      <option value="10">10 km</option>
                      <option value="15">15 km</option>
                    </select>
                  </label>
                </div>
              )}
            </>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10">
              <Loader2 className="size-5 animate-spin" />
              {text(
                "Live prijs en beschikbaarheid zoeken…",
                "Searching live prices and availability…",
              )}
            </div>
          ) : !searchProvider ? (
            <p className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              {text(
                "Controleer eerst het aantal gasten en kamers. GlobeTrotr zoekt pas nadat je op de zoekknop drukt.",
                "First check the number of guests and rooms. GlobeTrotr only searches after you press the search button.",
              )}
            </p>
          ) : !results.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {text(
                "Geen verblijven binnen 15 km gevonden.",
                "No accommodation found within 15 km.",
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {searchProvider === "booking" && <p className="text-xs text-muted-foreground">{text(
                "Boeken opent de resultaatpagina bij Booking.com. Controleer het verblijf, de datums en de definitieve prijs bij de aanbieder.",
                "Book opens the result page on Booking.com. Verify the accommodation, dates and final price with the provider.",
              )}</p>}
              {searchProvider === "openstreetmap" && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  {text(
                    "Booking.com gaf geen live resultaten. Deze kaartresultaten hebben geen prijs of beschikbaarheidscontrole.",
                    "Booking.com returned no live results. These map results do not include price or availability checks.",
                  )}
                </p>
              )}
              {visibleResults.length === 0 && (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">
                  {text(
                    "Geen resultaten passen bij deze filters. Verruim een filter om meer te zien.",
                    "No results match these filters. Widen a filter to see more.",
                  )}
                </p>
              )}
              {visibleResults.map((result) => (
                <ResultRow
                  key={result.id}
                  result={result}
                  editable={editable}
                  saving={saving}
                  text={text}
                  onCandidate={() => void addCandidate(result)}
                  onBooked={() => {
                    setBookingReference("");
                    setBookingResult(result);
                  }}
                />
              ))}
            </div>
          )}
          {searchProvider === "openstreetmap" && (
            <p className="text-xs text-muted-foreground">
              ©{" "}
              <a
                className="underline"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenStreetMap contributors
              </a>
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(bookingResult)}
        onOpenChange={(open) => {
          if (!open) setBookingResult(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text("Verblijfsboeking bevestigen", "Confirm accommodation booking")}
            </DialogTitle>
          </DialogHeader>
          {gap && bookingResult && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <strong className="block">{bookingResult.name}</strong>
                <span>
                  {gap.startDate} – {gap.endDate} · {gap.nights}{" "}
                  {gap.nights === 1 ? text("nacht", "night") : text("nachten", "nights")}
                </span>
                <span className="block text-muted-foreground">
                  {gap.stopName}
                  {gap.country ? ` · ${gap.country}` : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {text(
                  "Gebruik dit alleen nadat je bij de aanbieder hebt geboekt.",
                  "Use this only after booking with the provider.",
                )}
              </p>
              <label className="space-y-1">
                <span className="text-sm font-medium">
                  {text("Boekingsnummer (optioneel)", "Booking reference (optional)")}
                </span>
                <Input
                  value={bookingReference}
                  maxLength={160}
                  onChange={(event) => setBookingReference(event.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBookingResult(undefined)}>
                  {text("Annuleren", "Cancel")}
                </Button>
                <Button disabled={Boolean(saving)} onClick={() => void confirmBooking()}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {text("Als boeking toevoegen", "Add as booking")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GapRow({
  item,
  trip,
  editable,
  loading,
  selected,
  editing,
  text,
  onSelect,
  onEdit,
  onSearch,
  nights,
  onNightsChange,
}: {
  item: TripHotelGap;
  trip: Trip;
  editable: boolean;
  loading: boolean;
  selected: string;
  editing: boolean;
  text: Text;
  onSelect: (value: string) => void;
  onEdit: () => void;
  onSearch: () => void;
  nights: string;
  onNightsChange: (value: string) => void;
}) {
  const suggestion =
    trip.stops.find((stop) => stop.id === item.suggestedStopId) ?? item.suggestedLocation;
  const nightsHintId = useId();
  const showSelect = !suggestion || editing;
  let period;
  try { period = hotelGapSearchPeriod(item, Number(nights)); } catch { /* Invalid input disables opening the search. */ }
  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
      <div>
        <strong>
          {item.startDate} – {item.endDate}
        </strong>
        <p className="text-sm text-muted-foreground">
          {item.nights}{" "}
          {item.nights === 1
            ? text("nacht zonder verblijf", "night without accommodation")
            : text("nachten zonder verblijf", "nights without accommodation")}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="font-medium">
          {suggestion
            ? text("Waarschijnlijke slaapplaats", "Likely overnight location")
            : text("Waar wil je overnachten?", "Where do you want to stay?")}
        </span>
        {showSelect ? (
          <select
            aria-label={text("Slaapplaats", "Overnight location")}
            className="h-10 w-full rounded-md border bg-background px-3"
            value={selected}
            disabled={!editable}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="">{text("Kies een routeplaats", "Choose a route location")}</option>
            {trip.stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
                {stop.country ? ` · ${stop.country}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3">
            <span>
              <strong>{suggestion.name}</strong>
              {suggestion.country ? ` · ${suggestion.country}` : ""}
            </span>
            <Button type="button" size="sm" variant="ghost" disabled={!editable} onClick={onEdit}>
              <Pencil className="size-3.5" />
              {text("Wijzigen", "Change")}
            </Button>
          </div>
        )}
      </div>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="font-medium">{text("Aantal nachten", "Number of nights")}</span>
        <Input className="h-10" type="number" min={1} max={Math.min(60, item.nights)} step={1} value={nights} disabled={!editable || loading} aria-invalid={!period} aria-describedby={nightsHintId} onChange={(event) => onNightsChange(event.target.value)} />
      </label>
      <Button
        type="button"
        className="h-10 w-full md:w-auto"
        disabled={!editable || loading || !period || (!selected && !item.suggestedLocation)}
        onClick={onSearch}
      >
        <Search className="size-4" />
        {text("Zoek verblijven", "Find stays")}
      </Button>
      <p id={nightsHintId} className="text-xs text-muted-foreground md:col-span-2 md:text-right xl:col-span-4">{period
        ? text(`Uitchecken: ${period.endDate}`, `Check-out: ${period.endDate}`)
        : text(`Kies 1–${Math.min(60, item.nights)} nachten`, `Choose 1–${Math.min(60, item.nights)} nights`)}</p>
    </div>
  );
}

function ResultRow({
  result,
  editable,
  saving,
  text,
  onCandidate,
  onBooked,
}: {
  result: HotelSearchResult;
  editable: boolean;
  saving?: string;
  text: Text;
  onCandidate: () => void;
  onBooked: () => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong>{result.name}</strong>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {result.kind.replaceAll("_", " ")} · {result.distanceKm} km
            {result.stars ? ` · ${result.stars}★` : ""}
          </p>
          {result.reviewScore != null && (
            <p className="text-sm">
              {result.reviewScore.toFixed(1)}/10
              {result.reviewCount
                ? ` · ${result.reviewCount} ${text("beoordelingen", "reviews")}`
                : ""}
            </p>
          )}
          {result.amount != null && result.currency && (
            <p className="font-semibold">
              {new Intl.NumberFormat(text("nl-NL", "en-GB"), {
                style: "currency",
                currency: result.currency,
              }).format(result.amount)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {text("totaal voor dit verblijf", "total for this stay")}
              </span>
              {result.taxesAndFees ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  +{" "}
                  {new Intl.NumberFormat(text("nl-NL", "en-GB"), {
                    style: "currency",
                    currency: result.currency,
                  }).format(result.taxesAndFees)}{" "}
                  {text("ter plaatse/uitgesloten kosten", "excluded/on-site charges")}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            {result.provider === "booking" ? (
              <a href={bookingHotelPartnerUrl(result.website ?? result.osmUrl)} target="_blank" rel="sponsored noopener noreferrer">
                <ExternalLink className="size-4" />
                {text("Boeken", "Book")}
              </a>
            ) : (
              <a href={result.website ?? result.osmUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {text("Bekijken", "View")}
              </a>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!editable || Boolean(saving)}
            onClick={onBooked}
          >
            {text("Al geboekt", "Already booked")}
          </Button>
          <Button size="sm" disabled={!editable || Boolean(saving)} onClick={onCandidate}>
            {saving === result.id && <Loader2 className="size-4 animate-spin" />}
            {text("Bewaar als kandidaat", "Save as candidate")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <strong className="block text-xl">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
