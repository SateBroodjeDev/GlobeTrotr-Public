import { createFileRoute } from "@tanstack/react-router";
import { sha256 } from "@/lib/self-hosted-license.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const Route = createFileRoute("/api/licensing/v1/deactivate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (Number(request.headers.get("content-length") || 0) > 2048)
            return Response.json({ error: "invalid_request" }, { status: 400 });
          const secret = (request.headers.get("authorization") || "").replace(/^Bearer /, ""),
            body = (await request.json()) as { installationKey?: string };
          if (!secret.startsWith("gti_") || !body.installationKey)
            return Response.json({ error: "invalid_installation" }, { status: 401 });
          const db = supabaseAdmin as any,
            row = await db
              .from("self_hosted_installations")
              .update({
                revoked_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("installation_key", body.installationKey)
              .eq("secret_hash", sha256(secret))
              .is("revoked_at", null)
              .select("id,license_id")
              .maybeSingle();
          if (!row.data) return Response.json({ error: "invalid_installation" }, { status: 401 });
          await db.from("self_hosted_license_events").insert({
            license_id: row.data.license_id,
            installation_id: row.data.id,
            event_type: "installation.deactivated",
          });
          return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }
      },
    },
  },
});
