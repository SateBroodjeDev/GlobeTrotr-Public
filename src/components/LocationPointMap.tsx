import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale";
import type { CircleMarker } from "leaflet";

export function LocationPointMap({
  point,
  disabled,
  onPick,
}: {
  point?: { lat: number; lon: number };
  disabled?: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  const { text } = useLocale(),
    element = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const callback = useRef(onPick),
    blocked = useRef(disabled);
  callback.current = onPick;
  blocked.current = disabled;
  const lat = point?.lat,
    lon = point?.lon;
  const latestPoint = useRef(point), updatePoint = useRef<(point?: {lat:number;lon:number}) => void>(() => {});
  latestPoint.current = point;
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("leaflet")
      .then(({ default: L }) => {
        if (cancelled || !element.current) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const initial = latestPoint.current;
        const map = L.map(element.current, {
          scrollWheelZoom: false,
          zoomAnimation: !reduced,
          fadeAnimation: !reduced,
        }).setView([initial?.lat ?? 30, initial?.lon ?? 0], initial ? 16 : 1);
        const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        let loadedTile = false, marker: CircleMarker | undefined;
        tiles.on("tileload", () => { loadedTile = true; if (!cancelled) setFailed(false); });
        tiles.on("tileerror", () => { if (!cancelled && !loadedTile) setFailed(true); });
        const draw = (next?: {lat:number;lon:number}) => {
          if (!next) { marker?.remove(); marker = undefined; return; }
          if (marker) marker.setLatLng([next.lat, next.lon]);
          else marker = L.circleMarker([next.lat, next.lon], { radius: 7, color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.8 }).addTo(map);
          map.setView([next.lat, next.lon], Math.max(16, map.getZoom()), { animate: false });
        };
        updatePoint.current = draw; draw(latestPoint.current);
        map.on("click", (event) => {
          if (!blocked.current) callback.current(event.latlng.lat, event.latlng.lng);
        });
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(element.current);
        dispose = () => {
          observer.disconnect();
          updatePoint.current = () => {};
          map.stop();
          map.remove();
        };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  useEffect(() => { updatePoint.current(lat === undefined || lon === undefined ? undefined : { lat, lon }); }, [lat, lon]);
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        {failed
          ? text(
              "De kaart kon niet laden. Gebruik zoeken of voer hieronder bekende coördinaten in.",
              "The map could not load. Use search or enter known coordinates below.",
            )
          : text(
              "Klik op de juiste plek om het kaartpunt te kiezen. Je kunt hieronder ook coördinaten invullen.",
              "Click the correct spot to choose the map point, or enter coordinates below.",
            )}
      </p>
      <div
        ref={element}
        role="region"
        aria-label={text("Kaartpunt kiezen", "Choose map point")}
        className="isolate h-44 w-full rounded-lg border"
      />
    </div>
  );
}
