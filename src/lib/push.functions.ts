import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const HTTPS = /^https:\/\//;
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      result = await client
        .from("web_push_subscriptions")
        .select("id,endpoint")
        .eq("user_id", context.userId)
        .is("revoked_at", null);
    if (result.error) throw new Error("WEB_PUSH_UNAVAILABLE");
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || "",
      endpoints: (result.data ?? []).map((x: any) => x.endpoint as string),
    };
  });
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      endpoint: string;
      expirationTime: number | null;
      keys: { p256dh: string; auth: string };
      userAgent: string;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    if (
      !HTTPS.test(data.endpoint) ||
      data.endpoint.length > 2048 ||
      data.keys.p256dh.length < 40 ||
      data.keys.p256dh.length > 200 ||
      data.keys.auth.length < 10 ||
      data.keys.auth.length > 100
    )
      throw new Error("INVALID_PUSH_SUBSCRIPTION");
    const { publicHttpsHostname } = await import("../../worker/public-network.mjs");
    publicHttpsHostname(data.endpoint);
    const client = await db(),
      result = await client
        .from("web_push_subscriptions")
        .upsert(
          {
            user_id: context.userId,
            endpoint: data.endpoint,
            p256dh: data.keys.p256dh,
            auth_secret: data.keys.auth,
            user_agent: data.userAgent.slice(0, 300) || null,
            expires_at: data.expirationTime ? new Date(data.expirationTime).toISOString() : null,
            revoked_at: null,
            last_failure_code: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        );
    if (result.error) throw new Error("PUSH_SUBSCRIPTION_SAVE_FAILED");
    return { ok: true };
  });
export const revokePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((x: { endpoint: string }) => x)
  .handler(async ({ data, context }) => {
    if (!HTTPS.test(data.endpoint) || data.endpoint.length > 2048)
      throw new Error("INVALID_PUSH_SUBSCRIPTION");
    const client = await db(),
      result = await client
        .from("web_push_subscriptions")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("endpoint", data.endpoint);
    if (result.error) throw new Error("PUSH_SUBSCRIPTION_REVOKE_FAILED");
    return { ok: true };
  });
export const sendPushTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      result = await client.rpc("queue_web_push_test", { p_user: context.userId });
    if (result.error) throw new Error("PUSH_TEST_FAILED");
    return { ok: true, notificationId: result.data as string };
  });
