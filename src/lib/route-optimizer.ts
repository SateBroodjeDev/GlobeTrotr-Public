import type { Stop } from "@/lib/types";

export type RouteLeg = { from: string; to: string; distanceKm: number; durationMinutes: number };
export type RouteProposal = {
  original: Stop[];
  proposed: Stop[];
  originalLegs: RouteLeg[];
  proposedLegs: RouteLeg[];
  originalDistanceKm: number;
  proposedDistanceKm: number;
  savedDistanceKm: number;
  savedDurationMinutes: number;
  changed: boolean;
};

function radians(value: number) { return value * Math.PI / 180; }

export function directDistanceKm(a: Pick<Stop, "lat" | "lon">, b: Pick<Stop, "lat" | "lon">) {
  const latitude = radians(b.lat - a.lat), longitude = radians(b.lon - a.lon);
  const value = Math.sin(latitude / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function legs(stops: Stop[]): RouteLeg[] {
  return stops.slice(1).map((stop, index) => {
    const previous = stops[index]!;
    const distanceKm = directDistanceKm(previous, stop);
    return {
      from: previous.name,
      to: stop.name,
      distanceKm,
      // Rustige vergelijkingsindicatie; dit is geen navigatie- of verkeersvoorspelling.
      durationMinutes: Math.round(distanceKm / 70 * 60),
    };
  });
}

function total(items: RouteLeg[], field: "distanceKm" | "durationMinutes") {
  return items.reduce((sum, item) => sum + item[field], 0);
}

export function proposeRouteOrder(stops: Stop[]): RouteProposal {
  if (stops.length < 3) {
    const originalLegs = legs(stops);
    return { original: stops, proposed: stops, originalLegs, proposedLegs: originalLegs, originalDistanceKm: total(originalLegs, "distanceKm"), proposedDistanceKm: total(originalLegs, "distanceKm"), savedDistanceKm: 0, savedDurationMinutes: 0, changed: false };
  }
  const remaining = stops.slice(1), proposed = [stops[0]!];
  while (remaining.length) {
    const current = proposed[proposed.length - 1]!;
    let nearest = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (directDistanceKm(current, remaining[index]!) < directDistanceKm(current, remaining[nearest]!)) nearest = index;
    }
    proposed.push(remaining.splice(nearest, 1)[0]!);
  }
  const originalLegs = legs(stops), proposedLegs = legs(proposed);
  const originalDistanceKm = total(originalLegs, "distanceKm"), proposedDistanceKm = total(proposedLegs, "distanceKm");
  const savedDistanceKm = Math.max(0, originalDistanceKm - proposedDistanceKm);
  return {
    original: stops,
    proposed,
    originalLegs,
    proposedLegs,
    originalDistanceKm,
    proposedDistanceKm,
    savedDistanceKm,
    savedDurationMinutes: Math.round(savedDistanceKm / 70 * 60),
    changed: stops.some((stop, index) => stop.id !== proposed[index]?.id) && proposedDistanceKm < originalDistanceKm,
  };
}
