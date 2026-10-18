import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function admin(userId: string) {
  const db = await database();
  const [{ data: user }, { data: staff }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from("platform_admins")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (
    user.user?.app_metadata?.corporate_admin !== true ||
    !staff ||
    (staff.role !== "owner" && staff.permissions?.finance !== true)
  )
    throw new Error("FORBIDDEN");
  return db;
}
export const getSelfHostedSalesState = createServerFn({ method: "GET" }).handler(async () => {
  const db = await database(),
    flag = await db
      .from("platform_feature_flags")
      .select("enabled,audience")
      .eq("flag_key", "self_hosted.sales")
      .maybeSingle();
  return { enabled: Boolean(flag.data?.enabled && flag.data?.audience === "all") };
});
export const getMySelfHostedLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await database(),
      customer = await db
        .from("self_hosted_customers")
        .select("id,legal_name,support_email")
        .eq("owner_user_id", context.userId)
        .maybeSingle();
    if (!customer.data) return { customer: null, licenses: [] };
    const licenses = await db
      .from("self_hosted_licenses")
      .select(
        "id,license_number,license_type,status,major_version,installation_limit,test_installation_limit,entitlements,starts_at,expires_at,maintenance_ends_at,created_at,self_hosted_installations(id,installation_key,environment,domain,version,activated_at,last_seen_at,lease_expires_at,revoked_at)",
      )
      .eq("customer_id", customer.data.id)
      .order("created_at", { ascending: false });
    if (licenses.error) throw new Error("LICENSES_UNAVAILABLE");
    const ids = (licenses.data ?? []).map((item: any) => item.id);
    const secrets = ids.length
      ? await db
          .from("self_hosted_license_secrets")
          .select("license_id,key_prefix,created_at")
          .in("license_id", ids)
          .is("revoked_at", null)
      : { data: [] };
    const activeKeys = new Map((secrets.data ?? []).map((item: any) => [item.license_id, item]));
    return {
      customer: customer.data,
      licenses: (licenses.data ?? []).map((item: any) => ({
        ...item,
        activeKey: activeKeys.get(item.id) ?? null,
      })),
    };
  });
export const createMyLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { licenseId: string }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.licenseId)) throw new Error("INVALID_LICENSE");
    const db = await database(),
      license = await db
        .from("self_hosted_licenses")
        .select("id,status,self_hosted_customers!inner(owner_user_id)")
        .eq("id", data.licenseId)
        .eq("self_hosted_customers.owner_user_id", context.userId)
        .maybeSingle();
    if (!license.data || license.data.status !== "active") throw new Error("LICENSE_NOT_ACTIVE");
    const existing = await db
      .from("self_hosted_license_secrets")
      .select("id")
      .eq("license_id", data.licenseId)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing.data) throw new Error("LICENSE_KEY_ALREADY_EXISTS");
    const { token, sha256 } = await import("@/lib/self-hosted-license.server");
    const raw = token("gt_sh_"),
      result = await db.from("self_hosted_license_secrets").insert({
        license_id: data.licenseId,
        key_prefix: raw.slice(0, 16),
        key_hash: sha256(raw),
        created_by: context.userId,
      });
    if (result.error) throw new Error("LICENSE_KEY_CREATE_FAILED");
    return { key: raw };
  });
export const rotateMyLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { licenseId: string }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.licenseId)) throw new Error("INVALID_LICENSE");
    const db = await database(),
      license = await db
        .from("self_hosted_licenses")
        .select("id,status,self_hosted_customers!inner(owner_user_id)")
        .eq("id", data.licenseId)
        .eq("self_hosted_customers.owner_user_id", context.userId)
        .maybeSingle();
    if (!license.data || license.data.status !== "active") throw new Error("LICENSE_NOT_ACTIVE");
    await db
      .from("self_hosted_license_secrets")
      .update({ revoked_at: new Date().toISOString() })
      .eq("license_id", data.licenseId)
      .is("revoked_at", null);
    const { token, sha256 } = await import("@/lib/self-hosted-license.server"),
      raw = token("gt_sh_"),
      result = await db.from("self_hosted_license_secrets").insert({
        license_id: data.licenseId,
        key_prefix: raw.slice(0, 16),
        key_hash: sha256(raw),
        created_by: context.userId,
      });
    if (result.error) throw new Error("LICENSE_KEY_ROTATE_FAILED");
    await db.from("self_hosted_audit_log").insert({
      actor_user_id: context.userId,
      license_id: data.licenseId,
      action: "license.key_rotated",
      reason: "Rotated by license owner",
    });
    return { key: raw };
  });
export const revokeMyInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { installationId: string }) => x)
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.installationId)) throw new Error("INVALID_INSTALLATION");
    const db = await database(),
      installation = await db
        .from("self_hosted_installations")
        .select(
          "id,license_id,self_hosted_licenses!inner(self_hosted_customers!inner(owner_user_id))",
        )
        .eq("id", data.installationId)
        .eq("self_hosted_licenses.self_hosted_customers.owner_user_id", context.userId)
        .is("revoked_at", null)
        .maybeSingle();
    if (!installation.data) throw new Error("INSTALLATION_NOT_FOUND");
    const now = new Date().toISOString();
    await db
      .from("self_hosted_installations")
      .update({ revoked_at: now, updated_at: now })
      .eq("id", data.installationId);
    await db.from("self_hosted_license_events").insert({
      license_id: installation.data.license_id,
      installation_id: data.installationId,
      event_type: "installation.revoked_by_owner",
    });
    return { ok: true };
  });
export const getSelfHostedAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin(context.userId);
    const [customers, licenses, installations] = await Promise.all([
      db.from("self_hosted_customers").select("*").order("created_at", { ascending: false }),
      db.from("self_hosted_licenses").select("*").order("created_at", { ascending: false }),
      db
        .from("self_hosted_installations")
        .select(
          "id,license_id,environment,domain,version,activated_at,last_seen_at,lease_expires_at,revoked_at",
        )
        .order("last_seen_at", { ascending: false }),
    ]);
    if (customers.error || licenses.error || installations.error)
      throw new Error("SELF_HOSTED_ADMIN_UNAVAILABLE");
    return {
      customers: customers.data ?? [],
      licenses: licenses.data ?? [],
      installations: installations.data ?? [],
      signingConfigured: Boolean(process.env.SELF_HOSTED_LICENSE_SIGNING_PRIVATE_KEY?.trim()),
    };
  });
export const saveSelfHostedLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      ownerEmail: string;
      legalName: string;
      supportEmail: string;
      licenseType: "annual" | "perpetual";
      expiresAt: string | null;
      maintenanceEndsAt: string | null;
      installationLimit: number;
      testInstallationLimit: number;
      reason: string;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    if (
      data.reason.trim().length < 5 ||
      !data.ownerEmail.includes("@") ||
      !data.supportEmail.includes("@")
    )
      throw new Error("INVALID_LICENSE");
    const db = await admin(context.userId),
      user = await db
        .from("profiles")
        .select("id,email")
        .ilike("email", data.ownerEmail.trim())
        .maybeSingle();
    if (!user.data) throw new Error("OWNER_NOT_FOUND");
    const customer = await db
      .from("self_hosted_customers")
      .upsert(
        {
          owner_user_id: user.data.id,
          legal_name: data.legalName.trim(),
          support_email: data.supportEmail.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_user_id" },
      )
      .select("id")
      .single();
    if (customer.error) throw new Error("CUSTOMER_SAVE_FAILED");
    const number = `GTSH-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      license = await db
        .from("self_hosted_licenses")
        .insert({
          customer_id: customer.data.id,
          license_number: number,
          license_type: data.licenseType,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: data.licenseType === "annual" ? data.expiresAt : null,
          maintenance_ends_at: data.maintenanceEndsAt,
          installation_limit: Math.min(20, Math.max(1, data.installationLimit)),
          test_installation_limit: Math.min(10, Math.max(0, data.testInstallationLimit)),
          created_by: context.userId,
        })
        .select("id")
        .single();
    if (license.error) throw new Error("LICENSE_SAVE_FAILED");
    await db.from("self_hosted_audit_log").insert({
      actor_user_id: context.userId,
      license_id: license.data.id,
      action: "license.create",
      reason: data.reason.trim(),
      context: { licenseType: data.licenseType },
    });
    return { ok: true, id: license.data.id };
  });
export const updateSelfHostedLicenseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      licenseId: string;
      status: "active" | "past_due" | "suspended" | "revoked" | "refunded" | "expired";
      reason: string;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    if (!UUID.test(data.licenseId) || data.reason.trim().length < 5)
      throw new Error("INVALID_LICENSE_CHANGE");
    const db = await admin(context.userId),
      update = await db
        .from("self_hosted_licenses")
        .update({ status: data.status })
        .eq("id", data.licenseId)
        .select("id")
        .maybeSingle();
    if (!update.data) throw new Error("LICENSE_NOT_FOUND");
    if (["revoked", "refunded"].includes(data.status))
      await db
        .from("self_hosted_license_secrets")
        .update({ revoked_at: new Date().toISOString() })
        .eq("license_id", data.licenseId)
        .is("revoked_at", null);
    await db.from("self_hosted_audit_log").insert({
      actor_user_id: context.userId,
      license_id: data.licenseId,
      action: `license.${data.status}`,
      reason: data.reason.trim(),
    });
    return { ok: true };
  });
