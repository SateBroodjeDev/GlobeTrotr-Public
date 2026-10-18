import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256, signedLease, usable } from "@/lib/self-hosted-license-core";
export {
  sha256,
  signingConfigured,
  signedLease,
  token,
  usable,
} from "@/lib/self-hosted-license-core";
export async function licenseByRawKey(raw: string) {
  const db = supabaseAdmin as any;
  const secret = await db
    .from("self_hosted_license_secrets")
    .select("id,license_id")
    .eq("key_hash", sha256(raw))
    .is("revoked_at", null)
    .maybeSingle();
  if (secret.error || !secret.data) return null;
  await db
    .from("self_hosted_license_secrets")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", secret.data.id);
  const license = await db
    .from("self_hosted_licenses")
    .select("*,self_hosted_customers(legal_name)")
    .eq("id", secret.data.license_id)
    .maybeSingle();
  return license.data ?? null;
}
export async function installationByCredentials(rawSecret: string, installationKey: string) {
  if (!rawSecret.startsWith("gti_") || !installationKey.startsWith("inst_")) return null;
  const db = supabaseAdmin as any;
  const installation = await db
    .from("self_hosted_installations")
    .select("*")
    .eq("installation_key", installationKey)
    .eq("secret_hash", sha256(rawSecret))
    .is("revoked_at", null)
    .maybeSingle();
  if (!installation.data) return null;
  const license = await db
    .from("self_hosted_licenses")
    .select("*,self_hosted_customers(legal_name)")
    .eq("id", installation.data.license_id)
    .maybeSingle();
  if (!license.data) return null;
  return { installation: installation.data, license: license.data };
}
export async function issueLease(license: any, installation: any) {
  const expiresAt = new Date(Date.now() + 14 * 86400000);
  const payload = {
    iss: "https://globetrotr.nl",
    aud: "globetrotr-self-hosted",
    licenseId: license.id,
    licenseNumber: license.license_number,
    installationId: installation.id,
    installationKey: installation.installation_key,
    domain: installation.domain,
    environment: installation.environment,
    majorVersion: license.major_version,
    entitlements: license.entitlements,
    maintenanceEndsAt: license.maintenance_ends_at,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  const lease = signedLease(payload),
    db = supabaseAdmin as any;
  await db
    .from("self_hosted_installations")
    .update({
      last_seen_at: new Date().toISOString(),
      lease_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", installation.id);
  return {
    lease,
    expiresAt: expiresAt.toISOString(),
    entitlements: license.entitlements,
    majorVersion: license.major_version,
  };
}
