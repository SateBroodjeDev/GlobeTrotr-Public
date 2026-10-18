import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyCheckoutBinding(token, secret, plan, mode, customerId) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,512}\.[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  if (typeof secret !== "string" || secret.length < 32) return null;
  const [encoded, signature] = token.split(".");
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.w)) return null;
    if (claims.p !== plan || claims.m !== mode) return null;
    if (claims.c && claims.c !== customerId) return null;
    if (!Number.isSafeInteger(claims.t) || claims.t <= 0) return null;
    return claims.w;
  } catch {
    return null;
  }
}

export function trustedPaddleCustomData(raw, secret, plan, mode, customerId) {
  const customData = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const workspaceId = verifyCheckoutBinding(customData.checkout_binding, secret, plan, mode, customerId);
  delete customData.workspace_uuid;
  delete customData.workspaceUuid;
  if (workspaceId) customData.workspace_uuid = workspaceId;
  return customData;
}
