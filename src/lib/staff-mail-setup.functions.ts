import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOwnStaffSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { getCookie } = await import("@tanstack/react-start/server");
    const { STAFF_COOKIE, verifyStaffSession } = await import("./staff-session.server");
    if (
      !verifyStaffSession(
        getCookie(STAFF_COOKIE),
        context.userId,
        String(context.claims.session_id || ""),
        process.env.STAFF_SESSION_SIGNING_KEY || "",
      )
    )
      throw new Error("STAFF_SSO_REQUIRED");
    const [role, job, mail, proof] = await Promise.all([
      db
        .from("platform_admins")
        .select("role,active,permissions")
        .eq("user_id", context.userId)
        .maybeSingle(),
      db
        .from("staff_identity_provisioning")
        .select("status,error_code")
        .eq("user_id", context.userId)
        .maybeSingle(),
      db
        .from("corporate_mailboxes")
        .select(
          "address,active,provisioning_status,provisioning_error_code,managed_import_credential_id,sync_status,last_synced_at,last_sync_error_code",
        )
        .eq("owner_user_id", context.userId)
        .eq("mailbox_type", "personal")
        .maybeSingle(),
      db.from("staff_sso_sessions").select("expires_at")
        .eq("user_id", context.userId).eq("session_id", String(context.claims.session_id || ""))
        .maybeSingle(),
    ]);
    if (proof.error || !proof.data || !(Date.parse(proof.data.expires_at) > Date.now()))
      throw new Error("STAFF_SSO_REQUIRED");
    if (role.error || job.error || mail.error || !role.data?.active)
      throw new Error("STAFF_SETUP_UNAVAILABLE");
    return {
      userId: context.userId,
      managed: Boolean(job.data),
      identity: job.data?.status,
      identityError: job.data?.error_code,
      mailbox: mail.data
        ? {
            address: mail.data.address,
            active: mail.data.active,
            status: mail.data.provisioning_status,
            provisioningError: mail.data.provisioning_error_code,
            connected: Boolean(mail.data.managed_import_credential_id),
            sync: mail.data.sync_status,
            lastSyncedAt: mail.data.last_synced_at,
            syncError: mail.data.last_sync_error_code,
          }
        : null,
      mailAllowed: role.data.role === "owner" || role.data.permissions?.mail === true,
      enabled:
        process.env.STAFF_AUTOMATION_ENABLED === "true" &&
        process.env.STAFF_MAIL_SETUP_ENABLED === "true",
    };
  });

export const beginOwnStaffMailSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (
      process.env.STAFF_AUTOMATION_ENABLED !== "true" ||
      process.env.STAFF_MAIL_SETUP_ENABLED !== "true"
    )
      throw new Error("STAFF_MAIL_SETUP_DISABLED");
    const { getCookie, setCookie } = await import("@tanstack/react-start/server");
    const { STAFF_COOKIE, verifyStaffSession } = await import("./staff-session.server");
    const sessionId = String(context.claims.session_id || "");
    if (
      !verifyStaffSession(
        getCookie(STAFF_COOKIE),
        context.userId,
        sessionId,
        process.env.STAFF_SESSION_SIGNING_KEY || "",
      )
    )
      throw new Error("STAFF_SSO_REQUIRED");
    const { encryptSecret } = await import("./secret-crypto.server");
    const { mailSetupAuthorization, MAIL_SETUP_COOKIE } = await import("./staff-mail-setup.server");
    // Check encryption configuration before reserving a challenge.
    encryptSecret("configuration-probe");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await (supabaseAdmin as any).rpc("begin_staff_mail_setup", {
      p_user: context.userId,
      p_session: sessionId,
    });
    if (result.error || !result.data) throw new Error("STAFF_MAIL_SETUP_UNAVAILABLE");
    const authorization = mailSetupAuthorization(result.data.token);
    setCookie(
      MAIL_SETUP_COOKIE,
      encryptSecret(
        JSON.stringify({
          userId: context.userId,
          sessionId,
          state: result.data.token,
          verifier: authorization.verifier,
          nonce: authorization.nonce,
          expires: Date.now() + 10 * 60_000,
        }),
      ),
      { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 },
    );
    return { url: authorization.url };
  });
