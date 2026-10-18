import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuthBasic as requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffLinkEligible, STAFF_SSO_PROVIDER } from "./staff-sso";

async function owner(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [user, admin] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from("platform_admins").select("role,active").eq("user_id", userId).maybeSingle(),
  ]);
  if (user.error || admin.error || !staffLinkEligible(user.data.user, admin.data))
    throw new Error("FORBIDDEN");
  return { db, user: user.data.user! };
}

export const getStaffLinkAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { user } = await owner(context.userId);
      return {
        allowed: true,
        linked:
          user.identities?.some((identity) => identity.provider === STAFF_SSO_PROVIDER) === true,
      };
    } catch {
      return { allowed: false, linked: false };
    }
  });

export const recordStaffLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { phase: "started" | "completed" }) => {
    if (!input || !["started", "completed"].includes(input.phase))
      throw new Error("INVALID_STAFF_LINK_EVENT");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, user } = await owner(context.userId);
    if (
      data.phase === "completed" &&
      !user.identities?.some((identity) => identity.provider === STAFF_SSO_PROVIDER)
    )
      throw new Error("STAFF_IDENTITY_NOT_LINKED");
    const { error } = await db.from("platform_admin_audit_log").insert({
      actor_user_id: context.userId,
      action: `staff_sso_link_${data.phase}`,
      target_type: "user",
      target_id: context.userId,
      result: "success",
      details: { provider: STAFF_SSO_PROVIDER },
    });
    if (error) throw new Error("STAFF_LINK_AUDIT_FAILED");
    return { userId: context.userId };
  });
