import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncStaffProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const user = await db.auth.admin.getUserById(context.userId);
    if (user.error || !user.data.user) throw new Error("STAFF_PROFILE_UNAVAILABLE");
    const { pushProfileToAuthentik } = await import("./staff-profile-outbound.server");
    const managed = await (db as any)
      .from("staff_identity_provisioning")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (managed.error) throw new Error("STAFF_PROFILE_UNAVAILABLE");
    return pushProfileToAuthentik(db, user.data.user, {
      token: process.env.AUTHENTIK_PROFILE_SYNC_API_TOKEN,
      signingKey: process.env.STAFF_SESSION_SIGNING_KEY,
      managed: Boolean(managed.data),
    });
  });
