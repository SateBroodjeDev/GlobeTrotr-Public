import { createFileRoute } from "@tanstack/react-router";
import { installationByCredentials, usable } from "@/lib/self-hosted-license.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const respond = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/licensing/v1/entitlements")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (Number(request.headers.get("content-length") || 0) > 2048)
            return respond({ error: "invalid_request" }, 400);
          const secret = (request.headers.get("authorization") || "").replace(/^Bearer /, ""),
            body = (await request.json()) as { installationKey?: string };
          const match = await installationByCredentials(secret, String(body.installationKey || ""));
          if (!match) return respond({ error: "invalid_installation" }, 401);
          if (!usable(match.license)) return respond({ error: "license_unavailable" }, 403);
          await (supabaseAdmin as any)
            .from("self_hosted_installations")
            .update({
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.installation.id);
          return respond({
            licenseNumber: match.license.license_number,
            licenseType: match.license.license_type,
            status: match.license.status,
            majorVersion: match.license.major_version,
            entitlements: match.license.entitlements,
            expiresAt: match.license.expires_at,
            maintenanceEndsAt: match.license.maintenance_ends_at,
            environment: match.installation.environment,
            domain: match.installation.domain,
          });
        } catch {
          return respond({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
