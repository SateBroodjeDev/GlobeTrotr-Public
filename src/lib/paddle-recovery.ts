import { createHmac, timingSafeEqual } from "node:crypto";

type Plan = "pro" | "agency";
type Mode = "one_time" | "recurring";

export function verifiedCheckoutWorkspace(
  token: unknown,
  secret: string | undefined,
  plan: Plan,
  mode: Mode,
): string | null {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,512}\.[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  if (!secret || secret.length < 32) return null;
  const [encoded, signature] = token.split(".");
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.w)) return null;
    if (claims.p !== plan || claims.m !== mode || !Number.isSafeInteger(claims.t) || claims.t <= 0) return null;
    return claims.w;
  } catch { return null; }
}

export function matchOneTimePaddlePrice(
  items: unknown,
  prices: { pro: string | undefined; agency: string | undefined },
): Plan | null {
  if (!Array.isArray(items) || items.length !== 1) return null;
  const price = items[0]?.price?.id;
  if (typeof price !== "string") return null;
  if (prices.pro?.trim() && price === prices.pro.trim()) return "pro";
  if (prices.agency?.trim() && price === prices.agency.trim()) return "agency";
  return null;
}
