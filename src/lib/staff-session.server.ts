import { createHmac, timingSafeEqual, createPublicKey, verify } from "node:crypto";

export const STAFF_COOKIE = "__Host-globetrotr-staff";
const ISSUER = "https://sso.globetrotr.nl/application/o/globetrotr-staff/";

export function signStaffSession(userId: string, sessionId: string, key: string, now = Date.now()) {
  if (key.length < 32 || !userId || !sessionId)
    throw new Error("STAFF_SESSION_CONFIGURATION_REQUIRED");
  const data = Buffer.from(
    JSON.stringify({ userId, sessionId, expires: now + 8 * 60 * 60_000 }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", key).update(data).digest("base64url")}`;
}

export function verifyStaffSession(
  value: string | undefined,
  userId: string,
  sessionId: string,
  key: string,
  now = Date.now(),
) {
  if (!value || value.length > 2000 || key.length < 32 || !sessionId) return false;
  try {
    const [data, signature, extra] = value.split(".");
    if (extra || !data || !signature) return false;
    const expected = createHmac("sha256", key).update(data).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const record = JSON.parse(Buffer.from(data, "base64url").toString());
    return (
      record.userId === userId &&
      record.sessionId === sessionId &&
      Number.isFinite(record.expires) &&
      record.expires > now &&
      record.expires <= now + 8 * 60 * 60_000
    );
  } catch {
    return false;
  }
}

/** Require a signed, current token for our exact Authentik application, not a linked identity alone. */
export async function verifyStaffProviderToken(
  token: string,
  clientId: string,
  fetcher = fetch,
  now = Date.now(),
) {
  if (!clientId || !token || token.length > 16000) throw new Error("STAFF_PROOF_REQUIRED");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("STAFF_PROOF_INVALID");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    claims.iss !== ISSUER ||
    !(claims.aud === clientId || (Array.isArray(claims.aud) && claims.aud.includes(clientId))) ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    !Number.isFinite(claims.exp) ||
    claims.exp * 1000 <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat * 1000 > now + 30000 ||
    now - claims.iat * 1000 > 5 * 60_000 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf * 1000 > now + 30000))
  )
    throw new Error("STAFF_PROOF_INVALID");
  const response = await fetcher(`${ISSUER}jwks/`, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("STAFF_PROVIDER_UNAVAILABLE");
  const body = await response.json();
  const keys = Array.isArray(body.keys)
    ? body.keys.filter(
        (key: { kid?: string; kty?: string; use?: string; alg?: string }) =>
          key.kid === header.kid &&
          key.kty === "RSA" &&
          (!key.use || key.use === "sig") &&
          (!key.alg || key.alg === "RS256"),
      )
    : [];
  if (
    keys.length !== 1 ||
    !verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: keys[0], format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    throw new Error("STAFF_PROOF_INVALID");
  return claims.sub as string;
}
