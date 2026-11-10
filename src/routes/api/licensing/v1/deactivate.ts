import { readBoundedJson } from "@/lib/bounded-json";
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
            body = (await readBoundedJson(request, 2048)) as { installationKey?: string };
          if (!secret.startsWith("gti_") || !body.installationKey)
            return Response.json({ error: "invalid_installation" }, { status: 401 });
          const result = await (supabaseAdmin as any).rpc("revoke_self_hosted_installation", {
            p_id: null, p_actor: null, p_key: body.installationKey, p_secret_hash: sha256(secret),
          });
          if (result.error || result.data !== true) return Response.json({ error: "invalid_installation" }, { status: 401 });
          return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }
      },
    },
  },
});
