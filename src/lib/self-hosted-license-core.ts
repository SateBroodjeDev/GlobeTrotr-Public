import { createHash, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = (prefix: string, bytes = 32) =>
  `${prefix}${randomBytes(bytes).toString("base64url")}`;
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signingConfigured() {
  try {
    const configured = process.env.SELF_HOSTED_LICENSE_SIGNING_PRIVATE_KEY?.trim();
    return Boolean(configured && createPrivateKey(Buffer.from(configured, "base64").toString("utf8")).asymmetricKeyType === "ed25519");
  } catch { return false; }
}

export function signedLease(payload: Record<string, unknown>) {
  const raw = encoded(payload),
    configured = process.env.SELF_HOSTED_LICENSE_SIGNING_PRIVATE_KEY?.trim();
  if (!configured) throw new Error("LICENSE_SIGNING_NOT_CONFIGURED");
  const pem = Buffer.from(configured, "base64").toString("utf8");
  const signature = sign(null, Buffer.from(raw), createPrivateKey(pem)).toString("base64url");
  return `gtlease1.${raw}.${signature}`;
}

export function usable(license: any) {
  const now = Date.now();
  if (!["active", "past_due"].includes(license?.status)) return false;
  if (
    license.license_type === "annual" &&
    license.expires_at &&
    Date.parse(license.expires_at) + license.grace_days * 86400000 < now
  )
    return false;
  return true;
}

/** ACK-loss retry returns the same secret, never a new secret for an old response. */
export function activationSecret(rawKey: string, requestKey: string, domain: string, environment: string, version: string) {
 return "gti_" + createHmac("sha256", rawKey).update(JSON.stringify(["activation-v1", requestKey, domain, environment, version])).digest("base64url");
}
