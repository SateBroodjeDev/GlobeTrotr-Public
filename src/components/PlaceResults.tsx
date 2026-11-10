import {
  Plane,
  TrainFront,
  Bus,
  Ship,
  Route,
  House,
  Building2,
  MapPin,
  Globe2,
  BedDouble,
  Camera,
} from "lucide-react";
import type { GeoPlaceType, GeoResult } from "@/lib/services";
import { useLocale } from "@/lib/locale";
import { localizeCountry } from "@/lib/localized-values";
const PLACE_TYPES: Record<GeoPlaceType, { nl: string; en: string; icon: typeof MapPin }> = {
  airport: { nl: "Luchthaven", en: "Airport", icon: Plane },
  train_station: { nl: "Treinstation", en: "Train station", icon: TrainFront },
  bus_stop: { nl: "Bushalte / busstation", en: "Bus stop / station", icon: Bus },
  ferry_terminal: { nl: "Veerterminal", en: "Ferry terminal", icon: Ship },
  street: { nl: "Straat", en: "Street", icon: Route },
  address: { nl: "Adres", en: "Address", icon: House },
  city: { nl: "Stad", en: "City", icon: Building2 },
  town: { nl: "Plaats", en: "Town", icon: Building2 },
  village: { nl: "Dorp", en: "Village", icon: House },
  country: { nl: "Land", en: "Country", icon: Globe2 },
  accommodation: { nl: "Accommodatie", en: "Accommodation", icon: BedDouble },
  attraction: { nl: "Bezienswaardigheid", en: "Attraction", icon: Camera },
};

export function PlaceResults({
  results,
  onPick,
  disabled,
}: {
  results: GeoResult[];
  onPick: (value: GeoResult) => void;
  disabled?: boolean;
}) {
  const { locale, text } = useLocale();
  return (
    <ul className="mt-2 divide-y rounded-xl border border-border bg-card">
      {results.map((r, index) => {
        const kind = r.placeType ? PLACE_TYPES[r.placeType] : undefined;
        const Icon = kind?.icon ?? MapPin;
        return (
          <li key={`${r.lat}-${r.lon}-${index}`}>
            <button
              type="button"
              className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={disabled}
              onClick={() => {
                onPick(r);
              }}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{r.name}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{kind ? text(kind.nl, kind.en) : text("Locatie", "Place")}</span>
                  <span>{localizeCountry(r.country, locale)}</span>
                </span>
                {r.addressLine && (
                  <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                    {r.addressLine}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
