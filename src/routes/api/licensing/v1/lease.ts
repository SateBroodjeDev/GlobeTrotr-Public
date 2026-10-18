import { createFileRoute } from "@tanstack/react-router";
import { issueLease, sha256, usable } from "@/lib/self-hosted-license.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
const respond = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export const Route = createFileRoute("/api/licensing/v1/lease")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (Number(request.headers.get("content-length") || 0) > 4096)
            return respond({ error: "invalid_request" }, 400);
          const secret = (request.headers.get("authorization") || "").replace(/^Bearer /, ""),
            body = (await request.json()) as { installationKey?: string; version?: string };
          if (!secret.startsWith("gti_") || !body.installationKey)
            return respond({ error: "invalid_installation" }, 401);
          const db = supabaseAdmin as any,
            installation = await db
              .from("self_hosted_installations")
              .select("*")
              .eq("installation_key", body.installationKey)
              .eq("secret_hash", sha256(secret))
              .is("revoked_at", null)
              .maybeSingle();
          if (!installation.data) return respond({ error: "invalid_installation" }, 401);
          const license = await db
            .from("self_hosted_licenses")
            .select("*")
            .eq("id", installation.data.license_id)
            .maybeSingle();
          if (!license.data || !usable(license.data))
            return respond({ error: "license_unavailable" }, 403);
          if (body.version && String(body.version).length <= 40)
            installation.data.version = body.version;
          await db
            .from("self_hosted_installations")
            .update({ version: installation.data.version })
            .eq("id", installation.data.id);
          return respond(await issueLease(license.data, installation.data));
        } catch {
          return respond({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
