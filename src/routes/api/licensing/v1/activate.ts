import { activationSecret, signingConfigured } from "@/lib/self-hosted-license-core";
import { readBoundedJson } from "@/lib/bounded-json";
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
          const body = (await readBoundedJson(request, 8192)) as {
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
          if (!signingConfigured()) return json({ error: "activation_unavailable" }, 503);
          const license = await licenseByRawKey(key);
          if (!license || !usable(license)) return json({ error: "license_unavailable" }, 403);
          const db = supabaseAdmin as any;
          const secret = activationSecret(key, String(body.idempotencyKey), domain, environment, version);
          const activated = await db.rpc("activate_self_hosted_installation", {
            p_license: license.id, p_key_hash: sha256(key),
            p_request_hash: sha256(JSON.stringify([license.id, String(body.idempotencyKey)])),
            p_domain: domain, p_environment: environment, p_version: version,
            p_installation_key: token("inst_", 24), p_secret_hash: sha256(secret),
          });
          if (activated.error || !activated.data?.installation || !activated.data?.license)
            return json({ error: activated.error?.message?.includes("INSTALLATION_LIMIT") ? "installation_limit" : "activation_unavailable" }, 409);
          const row = activated.data.installation;
          return json({ ...(await issueLease(activated.data.license, row)),
            installationId: row.id, installationKey: row.installation_key, installationSecret: secret,
          }, activated.data.replayed ? 200 : 201);
        } catch {
          return json({ error: "invalid_request" }, 400);
        }
      },
    },
  },
});
