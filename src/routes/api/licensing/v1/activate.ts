import { createFileRoute } from "@tanstack/react-router";
import {
  issueLease,
  licenseByRawKey,
  sha256,
  token,
  usable,
} from "@/lib/self-hosted-license.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
const DOMAIN = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
export const Route = createFileRoute("/api/licensing/v1/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const length = Number(request.headers.get("content-length") || 0);
          if (length > 8192) return json({ error: "invalid_request" }, 400);
          const auth = request.headers.get("authorization") || "",
            key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!key.startsWith("gt_sh_") || key.length > 200)
            return json({ error: "invalid_license" }, 401);
          const body = (await request.json()) as {
            domain?: string;
            environment?: string;
            version?: string;
            idempotencyKey?: string;
          };
          const domain = String(body.domain || "")
              .trim()
              .toLowerCase(),
            environment = body.environment === "test" ? "test" : "production",
            version = String(body.version || "");
          if (
            !DOMAIN.test(domain) ||
            !VERSION.test(version) ||
            !body.idempotencyKey ||
            String(body.idempotencyKey).length > 100
          )
            return json({ error: "invalid_request" }, 400);
          const license = await licenseByRawKey(key);
          if (!license || !usable(license)) return json({ error: "license_unavailable" }, 403);
          const db = supabaseAdmin as any,
            existingEvent = await db
              .from("self_hosted_license_events")
              .select("installation_id")
              .eq("idempotency_key", body.idempotencyKey)
              .eq("license_id", license.id)
              .maybeSingle();
          if (existingEvent.data?.installation_id) {
            const existing = await db
              .from("self_hosted_installations")
              .select("*")
              .eq("id", existingEvent.data.installation_id)
              .is("revoked_at", null)
              .maybeSingle();
            if (existing.data) {
              const renewedSecret = token("gti_");
              await db
                .from("self_hosted_installations")
                .update({
                  secret_hash: sha256(renewedSecret),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.data.id);
              return json({
                ...(await issueLease(license, existing.data)),
                installationId: existing.data.id,
                installationKey: existing.data.installation_key,
                installationSecret: renewedSecret,
              });
            }
          }
          const count = await db
              .from("self_hosted_installations")
              .select("id", { count: "exact", head: true })
              .eq("license_id", license.id)
              .eq("environment", environment)
              .is("revoked_at", null),
            limit =
              environment === "test" ? license.test_installation_limit : license.installation_limit;
          if ((count.count ?? 0) >= limit) return json({ error: "installation_limit" }, 409);
          const secret = token("gti_"),
            installationKey = token("inst_", 24),
            created = await db
              .from("self_hosted_installations")
              .insert({
                license_id: license.id,
                installation_key: installationKey,
                environment,
                domain,
                version,
                secret_hash: sha256(secret),
              })
              .select("*")
              .single();
          if (created.error) return json({ error: "activation_failed" }, 409);
          await db.from("self_hosted_license_events").insert({
            license_id: license.id,
            installation_id: created.data.id,
            event_type: "installation.activated",
            idempotency_key: String(body.idempotencyKey),
            context: { domain, environment, version },
          });
          return json(
            {
              ...(await issueLease(license, created.data)),
              installationId: created.data.id,
              installationKey,
              installationSecret: secret,
            },
            201,
          );
        } catch {
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
