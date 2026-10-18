export type GpxImportPoint = { lat: number; lon: number; name: string; source: "waypoint" | "route" | "track" };

export const GPX_MAX_BYTES = 2 * 1024 * 1024;
export const GPX_MAX_POINTS = 500;

function decodeXml(value: string) {
  return value.replace(/&(?:lt|gt|amp|quot|apos);/g, (entity) => ({
    "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&apos;": "'",
  })[entity] ?? entity);
}

function attr(value: string, name: string) {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(value)?.[1];
}

function pointName(body: string, index: number) {
  const raw = /<(?:[\w.-]+:)?name(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?name\s*>/i.exec(body)?.[1] ?? "";
  const clean = decodeXml(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  return clean.slice(0, 120) || `GPX point ${index}`;
}

export function parseGpx(text: string): GpxImportPoint[] {
  if (!text.trim()) throw new Error("GPX_EMPTY");
  if (new TextEncoder().encode(text).length > GPX_MAX_BYTES) throw new Error("GPX_TOO_LARGE");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("GPX_UNSAFE_XML");
  if (!/<(?:[\w.-]+:)?gpx(?:\s|>)/i.test(text)) throw new Error("GPX_INVALID");

  const points: GpxImportPoint[] = [];
  const matcher = /<(?:[\w.-]+:)?(wpt|rtept|trkpt)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1\s*>|<(?:[\w.-]+:)?(wpt|rtept|trkpt)\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    if (points.length >= GPX_MAX_POINTS) throw new Error("GPX_TOO_MANY_POINTS");
    const tag = (match[1] ?? match[4]).toLowerCase();
    const attributes = match[2] ?? match[5] ?? "";
    const latitude = Number(attr(attributes, "lat"));
    const longitude = Number(attr(attributes, "lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    points.push({
      lat: latitude,
      lon: longitude,
      name: pointName(match[3] ?? "", points.length + 1),
      source: tag === "wpt" ? "waypoint" : tag === "rtept" ? "route" : "track",
    });
  }
  if (!points.length) throw new Error("GPX_NO_VALID_POINTS");
  return points;
}

export function isDuplicateGpxPoint(point: Pick<GpxImportPoint, "lat" | "lon">, existing: Array<{ lat: number; lon: number }>) {
  return existing.some((item) => Math.abs(item.lat - point.lat) < 0.0001 && Math.abs(item.lon - point.lon) < 0.0001);
}
