import { createServerFn } from "@tanstack/react-start";
import { managedStaffIdentityMatches } from "./staff-sso";
import { requireSupabaseAuthBasic as requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAFF_SSO_PROVIDER } from "./staff-sso";
import { staffLogoutDestination } from "./staff-logout";
import {
  STAFF_COOKIE,
  signStaffSession,
  verifyStaffProviderToken,
  verifyStaffSession,
} from "./staff-session.server";

async function staff(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [user, admin] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from("platform_admins").select("active,role").eq("user_id", userId).maybeSingle(),
  ]);
  if (user.error || admin.error) throw new Error("STAFF_ACCESS_CHECK_FAILED");
  return {
    db,
    user: user.data.user!,
    admin: admin.data,
    isStaff: user.data.user?.app_metadata?.corporate_admin === true || admin.data?.active === true,
  };
}

export const prepareGbtLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, user } = await staff(context.userId);
    // Supabase signOut defaults to all sessions, so revoke all matching GBT
    // staff proofs too. No browser-supplied user ID or destination is accepted.
    const revoked = await db.from("staff_sso_sessions" as never)
      .delete().eq("user_id", context.userId);
    if (revoked.error) throw new Error("STAFF_LOGOUT_FAILED");
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(STAFF_COOKIE, { path: "/", secure: true, httpOnly: true, sameSite: "lax" });
    deleteCookie("__Host-gbt-mail-setup", { path: "/", secure: true, httpOnly: true, sameSite: "lax" });
    return { redirect: staffLogoutDestination(user) };
  });

export const getStaffSecurityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    let verifiedSession = verifyStaffSession(
      getCookie(STAFF_COOKIE),
      context.userId,
      String(context.claims.session_id || ""),
      process.env.STAFF_SESSION_SIGNING_KEY || "",
    );
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    // These are independent reads for the same current user/session. Do not
    // serialize network roundtrips or cache authorization across requests.
    const [result, settings, proof] = await Promise.all([
      staff(context.userId),
      db.from("staff_security_settings").select("enforced").eq("id", true).single(),
      verifiedSession ? db
        .from("staff_sso_sessions" as never)
        .select("expires_at")
        .eq("session_id", String(context.claims.session_id || ""))
        .eq("user_id", context.userId)
        .maybeSingle() : Promise.resolve(null),
    ]);
    if (settings.error || !settings.data) throw new Error("STAFF_SECURITY_CONFIGURATION_REQUIRED");
    if (verifiedSession) {
      const expires = proof?.data && Date.parse((proof.data as { expires_at: string }).expires_at);
      verifiedSession =
        Boolean(proof && !proof.error && expires && Number.isFinite(expires) && expires > Date.now());
    }
    return {
      isStaff: result.isStaff,
      linked:
        result.user.identities?.some((identity) => identity.provider === STAFF_SSO_PROVIDER) ===
        true,
      proofConfigured: Boolean(
        process.env.STAFF_SSO_CLIENT_ID &&
        (process.env.STAFF_SESSION_SIGNING_KEY?.length || 0) >= 32,
      ),
      enforced:
        process.env.STAFF_SSO_ENFORCED === "true" ||
        (settings.data as { enforced: boolean }).enforced,
      databaseEnforced: (settings.data as { enforced: boolean }).enforced,
      applicationEnforced: process.env.STAFF_SSO_ENFORCED === "true",
      verifiedSession,
    };
  });

export const establishStaffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { providerToken: string }) => {
    if (!input || typeof input.providerToken !== "string" || input.providerToken.length > 16000)
      throw new Error("STAFF_PROOF_REQUIRED");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, user, admin, isStaff } = await staff(context.userId);
    if (!isStaff || !admin?.active || user.app_metadata?.corporate_admin !== true)
      throw new Error("FORBIDDEN");
    const subject = await verifyStaffProviderToken(
      data.providerToken,
      process.env.STAFF_SSO_CLIENT_ID || "",
    );
    if (
      !user.identities?.some(
        (identity) =>
          identity.provider === STAFF_SSO_PROVIDER && identity.identity_data?.sub === subject,
      )
    )
      throw new Error("STAFF_SUBJECT_MISMATCH");
    // Provisioning pins a signed Authentik PK to the original GBT UUID. Matching
    // email addresses or a newly linked OAuth identity cannot override it.
    const providerClaims = JSON.parse(
      Buffer.from(data.providerToken.split(".")[1], "base64url").toString(),
    );
    const expectedIdentity = await db
      .from("staff_identity_provisioning" as never)
      .select("authentik_user_pk,status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (expectedIdentity.error) throw new Error("STAFF_IDENTITY_BINDING_UNAVAILABLE");
    const expected = expectedIdentity.data as {
      authentik_user_pk: number | null;
      status: string;
    } | null;
    if (!managedStaffIdentityMatches(expected, providerClaims.globetrotr_user_pk))
      throw new Error("STAFF_MANAGED_IDENTITY_MISMATCH");
    const cookie = signStaffSession(
      context.userId,
      String(context.claims.session_id || ""),
      process.env.STAFF_SESSION_SIGNING_KEY || "",
    );
    const proof = await (db as any).rpc("register_staff_sso_proof", {
      p_session: context.claims.session_id,
      p_user: context.userId,
      p_pk: Number.isSafeInteger(providerClaims.globetrotr_user_pk)
        ? providerClaims.globetrotr_user_pk
        : null,
      p_subject: subject,
    });
    if (proof.error) throw new Error("STAFF_SESSION_REGISTRATION_FAILED");
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(STAFF_COOKIE, cookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    let profileSync: string = "needs_link";
    try {
      const { pushProfileToAuthentik, STAFF_PROFILE_ISSUER } =
        await import("./staff-profile-outbound.server");
      // Read only after cryptographic verification above; never trust browser IDs.
      const claims = providerClaims;
      const userPk = claims.globetrotr_user_pk;
      if (Number.isSafeInteger(userPk) && userPk > 0) {
        const metadata = {
          ...user.app_metadata,
          staff_profile_binding: { issuer: STAFF_PROFILE_ISSUER, subject, userPk },
        };
        const binding = await db.auth.admin.updateUserById(context.userId, {
          app_metadata: metadata,
        });
        if (binding.error) throw new Error("STAFF_PROFILE_BINDING_FAILED");
        user.app_metadata = metadata;
      }
      const result = await pushProfileToAuthentik(db, user, {
        token: process.env.AUTHENTIK_PROFILE_SYNC_API_TOKEN,
        signingKey: process.env.STAFF_SESSION_SIGNING_KEY,
        managed: expected !== null,
      });
      profileSync = result.status;
    } catch {
      profileSync = "failed";
    }
    return { verified: true, profileSync };
  });
