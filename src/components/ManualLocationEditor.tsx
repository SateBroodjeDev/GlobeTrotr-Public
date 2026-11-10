import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import type { GeoResult } from "@/lib/services";
import {
  applyAddressProposal,
  confirmedLocation,
  coordinateDraftPoint,
  locationDraft,
  locationFieldError,
  locationSearchInput,
  validLocationPoint,
  type LocationDraft,
} from "@/lib/manual-location";
import { reversePlaceServer, searchPlacesServer } from "@/lib/place.functions";
import { useLocale } from "@/lib/locale";
import { countryCode, countryOptions } from "@/lib/countries";
import { PlaceResults } from "@/components/PlaceResults";
import { LocationPointMap } from "@/components/LocationPointMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Inline editor also works inside an existing booking dialog, without nested dialogs. */
export function ManualLocationEditor({
  initialLocation,
  disabled,
  onPick,
  onCancel,
  confirmLabel,
}: {
  initialLocation?: GeoResult;
  disabled?: boolean;
  onPick: (value: GeoResult) => void | Promise<void>;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  const { locale, text } = useLocale(),
    id = useId();
  const [draft, setDraft] = useState(() => locationDraft(initialLocation));
  const [point, setPoint] = useState<GeoResult | undefined>(() => validLocationPoint(initialLocation) ? initialLocation : undefined);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [proposal, setProposal] = useState<GeoResult | null>();
  const [phase, setPhase] = useState<"lookup" | "save" | null>(null), [error, setError] = useState("");
  const busy = phase !== null;
  const [coordsDirty, setCoordsDirty] = useState(false);
  const [invalidField, setInvalidField] = useState<keyof LocationDraft | "coordinates">();
  const [coords, setCoords] = useState(() => ({ lat: validLocationPoint(initialLocation) ? String(initialLocation.lat) : "", lon: validLocationPoint(initialLocation) ? String(initialLocation.lon) : "" }));
  const generation = useRef(0), operation = useRef<"lookup" | "save" | null>(null), coordinateSection = useRef<HTMLDetailsElement>(null),
    fields = useRef<Partial<Record<keyof LocationDraft, HTMLInputElement | null>>>({});
  const language = locale === "en-GB" ? "en" : "nl";
  const countries = useMemo(() => countryOptions(locale), [locale]);
  useEffect(() => () => { generation.current++; }, []);
  function choosePoint(value: GeoResult) {
    generation.current++;
    setPoint(value);
    setCoords({ lat: String(value.lat), lon: String(value.lon) });
    setCoordsDirty(false); setInvalidField(undefined);
    setProposal(undefined);
    setResults([]);
    setError("");
  }
  const labels: Record<keyof LocationDraft, string> = {
    name: text("Naam", "Name"),
    addressLine: text("Adres / straat en huisnummer", "Address / street and number"),
    city: text("Stad of plaats", "City or town"),
    country: text("Land", "Country"),
  };
  function change(field: keyof LocationDraft, value: string) {
    generation.current++;
    setResults([]);
    setProposal(undefined);
    setError("");
    setInvalidField(undefined);
    setDraft((current) => ({ ...current, [field]: value }));
    // Labels and the explicitly chosen map position are independent. Only a
    // new search selection, map click or coordinate confirmation moves the pin.
  }
  async function lookup(reverse: boolean) {
    if (disabled || operation.current) return;
    const token = ++generation.current;
    operation.current = "lookup"; setPhase("lookup");
    setError("");
    setResults([]);
    setProposal(undefined);
    try {
      if (reverse && point) {
        const value = await reversePlaceServer({
          data: { lat: point.lat, lon: point.lon, language },
        });
        if (generation.current === token) {
          setProposal(value);
          if (!value)
            setError(
              text(
                "Geen adres gevonden. Je kunt het zelf invullen.",
                "No address found. You can enter it manually.",
              ),
            );
        }
      } else {
        const input = locationSearchInput(draft);
        if (!input.address && input.query.length > 160) throw new Error("QUERY_TOO_LONG");
        const values = await searchPlacesServer({ data: { ...input, language } });
        if (generation.current === token) {
          setResults(values);
          if (!values.length)
            setError(
              text(
                "Geen resultaat. Pas de invoer aan of voer het kaartpunt zelf in.",
                "No result. Adjust the details or enter the map coordinates.",
              ),
            );
        }
      }
    } catch {
      if (generation.current === token)
        setError(
          text(
            "Adres zoeken lukt niet. Controleer je invoer of probeer opnieuw.",
            "Address lookup failed. Check your details or try again.",
          ),
        );
    } finally {
      if (generation.current === token) { operation.current = null; setPhase(null); }
    }
  }
  async function confirm() {
    if (disabled || operation.current) return;
    const invalid = locationFieldError(draft);
    if (invalid) {
      setError(
        text(
          "Controleer het gemarkeerde veld. Naam en land zijn verplicht.",
          "Check the highlighted field. Name and country are required.",
        ),
      );
      fields.current[invalid]?.focus();
      setInvalidField(invalid);
      return;
    }
    if (!countryCode(draft.country) && draft.country !== initialLocation?.country) {
      setError(
        text(
          "Kies een geldig land uit de suggesties, of gebruik de tweeletterige landcode.",
          "Choose a valid country from the suggestions, or use its two-letter code.",
        ),
      );
      fields.current.country?.focus();
      setInvalidField("country");
      return;
    }
    if (coordsDirty || !validLocationPoint(point)) {
      setError(
        text(
          "Bevestig eerst de ingevulde coördinaten of kies het juiste kaartpunt.",
          "Confirm the entered coordinates or choose the correct map point first.",
        ),
      );
      setInvalidField("coordinates");
      if (coordinateSection.current) coordinateSection.current.open = true;
      coordinateSection.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    operation.current = "save"; setPhase("save");
    const token = generation.current;
    setError("");
    try {
      await onPick(confirmedLocation(draft, point));
    } catch {
      setError(
        text(
          "Opslaan mislukt. Je invoer blijft behouden; probeer opnieuw.",
          "Could not save. Your details are kept; try again.",
        ),
      );
    } finally {
      operation.current = null;
      if (generation.current === token) setPhase(null);
    }
  }
  return (
    <section
      aria-label={text("Locatiegegevens", "Location details")}
      className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-3"
    >
      <div>
        <h4 className="text-sm font-medium">{text("Locatiegegevens", "Location details")}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {text(
            "Vul de locatie in en bevestig het kaartpunt. Adres en plaats zijn optioneel als ze niet van toepassing zijn.",
            "Enter the location and confirm its map point. Address and city are optional when they do not apply.",
          )}
        </p>
      </div>
      <fieldset disabled={disabled || busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        {(["name", "addressLine", "city", "country"] as const).map((field) => (
          <label
            key={field}
            htmlFor={`${id}-${field}`}
            className={`min-w-0 space-y-1 text-xs ${field === "addressLine" || field === "name" ? "sm:col-span-2" : ""}`}
          >
            <span>
              {labels[field]}
              {field === "name" || field === "country" ? " *" : ""}
            </span>
            <Input
              id={`${id}-${field}`}
              ref={(node) => {
                fields.current[field] = node;
              }}
              list={field === "country" ? `${id}-countries` : undefined}
              value={draft[field]}
              maxLength={field === "addressLine" ? 240 : 160}
              required={field === "name" || field === "country"}
              aria-invalid={invalidField === field}
              onChange={(event) => change(field, event.target.value)}
              autoComplete={
                field === "country"
                  ? "country-name"
                  : field === "city"
                    ? "address-level2"
                    : field === "addressLine"
                      ? "street-address"
                      : "off"
              }
            />
          </label>
        ))}
      </fieldset>
      <datalist id={`${id}-countries`}>
        {countries.map((option) => (
          <option key={option.code} value={option.label} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || (!draft.name.trim() && !draft.addressLine.trim())}
          onClick={() => void lookup(false)}
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Search className="mr-2 size-4" />
          )}
          {text("Zoek op kaart", "Find on map")}
        </Button>
        {point && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={() => void lookup(true)}
          >
            {text("Adres controleren", "Check address")}
          </Button>
        )}
      </div>
      {results.length > 0 && (
        <PlaceResults
          results={results}
          disabled={disabled || busy}
          onPick={(value) => {
            choosePoint(value);
            setDraft((current) => ({ ...locationDraft(value), name: current.name || value.name }));
            setResults([]);
            setError("");
          }}
        />
      )}
      {proposal && (
        <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
          <strong>
            {text("Adresvoorstel van OpenStreetMap", "Address suggested by OpenStreetMap")}
          </strong>
          <p>
            {[proposal.addressLine, proposal.city, proposal.country].filter(Boolean).join(" · ")}
          </p>
          <p className="text-muted-foreground">
            {text(
              "Controleer dit adres; OSM kan een naburig gebouw vinden. Je naam en kaartpunt blijven behouden.",
              "Check this address; OSM can find a neighbouring building. Your name and map point are kept.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => {
              setDraft((current) => applyAddressProposal(current, proposal));
              setProposal(undefined);
            }}
          >
            {text("Adres overnemen", "Use address")}
          </Button>
        </div>
      )}
      {point && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-4 shrink-0 text-primary" />
          {text("Kaartpunt bevestigd", "Map point confirmed")}: {point.lat.toFixed(5)},{" "}
          {point.lon.toFixed(5)}{" "}
          <a
            href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=17/${point.lat}/${point.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {text("Bekijk", "View")}
          </a>
        </p>
      )}
      {point && <p className="text-xs text-muted-foreground">{text("Adreswijzigingen behouden dit kaartpunt. Kies alleen een ander punt als je de locatie wilt verplaatsen.", "Address edits keep this map point. Select another point only when you want to move the location.")}</p>}
      <LocationPointMap
        point={point}
        disabled={disabled || busy}
        onPick={(lat, lon) => {
          choosePoint({ ...draft, lat, lon });
        }}
      />
      <details ref={coordinateSection} className="text-xs text-muted-foreground">
        <summary className="cursor-pointer rounded py-2 hover:text-primary">
          {text("Kaartpunt zelf invoeren", "Enter map coordinates")}
        </summary>
        <p className="mb-2">
          {text(
            "Gebruik bekende breedte- en lengtegraad. Een decimale komma of punt mag; bevestig daarna je invoer.",
            "Use known latitude and longitude. A decimal comma or dot is accepted; confirm your entry afterwards.",
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["lat", "lon"] as const).map((key) => (
            <label key={key}>
              {key === "lat" ? text("Breedtegraad", "Latitude") : text("Lengtegraad", "Longitude")}
              <Input
                type="text"
                inputMode="decimal"
                aria-invalid={invalidField === "coordinates"}
                value={coords[key]}
                disabled={disabled || busy}
                onChange={(event) => {
                  generation.current++;
                  setCoords((current) => ({ ...current, [key]: event.target.value }));
                  setCoordsDirty(true);
                  setProposal(undefined);
                }}
              />
            </label>
          ))}
        </div>
        <Button
          type="button"
          className="mt-2"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            busy ||
            !coords.lat.trim() ||
            !coords.lon.trim() ||
            !coordinateDraftPoint(coords)
          }
          onClick={() => {
            const next = coordinateDraftPoint(coords);
            if (next) choosePoint({ ...draft, ...next });
          }}
        >
          <MapPin className="mr-2 size-3" />
          {text("Gebruik dit kaartpunt", "Use this map point")}
        </Button>
      </details>
      <p className="text-[10px] text-muted-foreground">
        ©{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        · Nominatim
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || phase === "save"}
          onClick={() => {
            generation.current++;
            operation.current = null; setPhase(null);
            onCancel();
          }}
        >
          {text("Annuleren", "Cancel")}
        </Button>
        <Button type="button" size="sm" disabled={disabled || busy} onClick={() => void confirm()}>
          {busy ? text("Even wachten…", "Please wait…") : confirmLabel ?? text("Locatie gebruiken", "Use location")}
        </Button>
      </div>
    </section>
  );
}
