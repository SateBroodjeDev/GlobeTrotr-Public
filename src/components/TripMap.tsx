import { useEffect, useRef, useState } from "react";
import type { Stop, TravelItem } from "@/lib/types";
import { visibleMapPoints, type TripMapFilters, groupTripMapPlaces, mapBookedRouteLegs, mapTripRouteLegs, type TripMapPoint } from "@/lib/route-map";
import { useLocale } from "@/lib/locale";
import { localizeCountry } from "@/lib/localized-values";

export type { TripMapPoint } from "@/lib/route-map";
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);

export default function TripMap({
  stops,
  activeStopId,
  onStopSelect,
  points = [],
  routeItems = [],
  startDate,
}: {
  stops: Stop[];
  activeStopId?: string;
  onStopSelect?: (id: string) => void;
  points?: TripMapPoint[];
  routeItems?: TravelItem[];
  startDate?: string;
}) {
  const { locale } = useLocale();
  const [filters, setFilters] = useState<TripMapFilters>({ route: true, lodging: true, activity: true, other: true });
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const legs = mapTripRouteLegs({ stops, travelItems: routeItems, start: startDate });
  const bookedLegs = mapBookedRouteLegs(routeItems);
  const calculatedCount = legs.filter(leg => leg.segment).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      let map = mapRef.current as any;
      if (!map) {
        map = L.map(ref.current, { scrollWheelZoom: false }).setView([20, 10], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 18,
        }).addTo(map);
        mapRef.current = map;
      }

      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) map.removeLayer(layer);
      });

      const bounds: [number, number][] = [];
      const currentLegs = mapTripRouteLegs({ stops, travelItems: routeItems, start: startDate });
      (filters.route ? currentLegs : []).forEach(({ from, to, mode, segment }) => {
        const line = segment ? segment.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
          : [[from.lat, from.lon], [to.lat, to.lon]] as [number, number][];
        bounds.push(...line);
        L.polyline(line, { color: mode === "flight" ? "#6366f1" : "#0f9b8e",
          weight: segment ? 4 : 2, ...(segment ? {} : { dashArray: "6 8", opacity: 0.65 }) }).addTo(map);
      });
      const places = groupTripMapPlaces(stops, filters.route ? currentLegs.flatMap(leg => [leg.from, leg.to]).filter(point => point.id.startsWith("booking:")) : [], visibleMapPoints(points, filters));
      places.forEach(place => {
        if (!filters.route && !place.points.length) return;
        bounds.push([place.lat, place.lon]);
        const rows = new Map<string, Set<string>>();
        for (const point of place.points) {
          const label = [point.title, point.date, point.startTime].filter(Boolean).join(" · ");
          const details = rows.get(label) ?? new Set<string>();
          if (point.detail) details.add(point.detail);
          rows.set(label, details);
        }
        const country = place.stops[0]?.stop.country;
        const visits = place.stops.length > 1 ? `<br/>${locale === "en-GB" ? "Route stops" : "Routepunten"}: ${place.stops.map(visit => visit.index + 1).join(", ")}` : "";
        const popup = `<b>${escapeHtml(place.name)}</b>${country ? `<br/>${escapeHtml(localizeCountry(country, locale))}` : ""}${visits}${rows.size ? `<ul>${[...rows].map(([title, details]) => `<li>${escapeHtml(title)}${details.size ? ` — ${[...details].map(escapeHtml).join(" · ")}` : ""}</li>`).join("")}</ul>` : ""}`;
        if (filters.route && place.stops.length) {
          const visit = place.stops.find(entry => entry.stop.id === activeStopId) ?? place.stops[0]!;
          const active = visit.stop.id === activeStopId;
          const size = active ? 34 : 28;
          L.marker([place.lat, place.lon], {
            icon: L.divIcon({
              className: "",
              html: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:999px;background:${active ? "#111827" : "oklch(0.52 0.115 var(--brand-hue))"};color:#fff;font:600 12px/1 system-ui;box-shadow:0 2px 8px rgba(0,0,0,.35)">${visit.index + 1}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          })
            .addTo(map)
            .bindPopup(popup)
            .on("click", () => onStopSelect?.(visit.stop.id));
        } else {
          const kind = place.points[0]?.kind;
          const color = kind === "expense" ? "#f59e0b" : kind === "journal" ? "#db2777" : kind === "booking" ? "#2563eb" : "#6366f1";
          L.circleMarker([place.lat, place.lon], { radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 2 }).addTo(map).bindPopup(popup);
        }
      });
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.35), { maxZoom: 8 });
      const activeStop = filters.route && stops.find((stop) => stop.id === activeStopId);
      if (activeStop) map.setView([activeStop.lat, activeStop.lon], Math.max(map.getZoom(), 7));
      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeStopId, filters, locale, onStopSelect, points, routeItems, startDate, stops]);

  useEffect(() => {
    return () => {
      const map = mapRef.current as any;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div className="min-w-0 space-y-2">
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-2 text-xs font-medium">{locale === "en-GB" ? "Show on map" : "Toon op kaart"}</legend>
      {([["route", "Route", "Route"], ["lodging", "Hotels", "Hotels"], ["activity", "Activiteiten", "Activities"], ["other", "Overige", "Other"]] as const).map(([key, nl, en]) => <label key={key} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${filters[key] ? "border-primary/30 bg-primary/10" : "bg-muted/30"}`}><input type="checkbox" checked={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.checked }))} />{locale === "en-GB" ? en : nl}</label>)}
    </fieldset>
    {!Object.values(filters).some(Boolean) && <p className="text-xs text-muted-foreground">{locale === "en-GB" ? "All layers are hidden. Your trip data is retained." : "Alle lagen zijn verborgen. Je reisgegevens blijven bewaard."}</p>}
    <div ref={ref} className="trip-map h-[500px] max-w-full overflow-hidden rounded-xl bg-muted sm:h-[560px]" />
    {filters.route && (legs.length > 0 || bookedLegs.length > 0) && <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {calculatedCount > 0 && <span><span aria-hidden="true" className="mr-1.5 inline-block w-5 border-t-2 border-primary" />{locale === "en-GB" ? "Solid: calculated road route" : "Doorgetrokken: berekende wegroute"}</span>}
      {calculatedCount < legs.length && <span><span aria-hidden="true" className="mr-1.5 inline-block w-5 border-t-2 border-dashed border-muted-foreground" />{locale === "en-GB" ? "Dashed: connection without road calculation" : "Gestippeld: verbinding zonder wegberekening"}</span>}
      {bookedLegs.some(leg => leg.departure && leg.arrival) && <span><span aria-hidden="true" className="mr-1.5 inline-block w-5 border-t-2 border-dashed border-indigo-500" />{locale === "en-GB" ? "Booked journeys: departure to arrival, including return travel; no calculated path" : "Geboekte trajecten: vertrek naar aankomst, inclusief terugreis; geen berekend pad"}</span>}
    </p>}
  </div>;
}
