import { createClient } from "@supabase/supabase-js";
import { auditedAdminFetch } from "./audited-admin-fetch";
export function createAuditedAdminClient(actor: string, permission: string) {
 const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error("ADMIN_DATABASE_UNAVAILABLE");
 const transport: typeof fetch = (input, init) => {
  const request = new Request(input, init), headers = new Headers(request.headers);
  if (new URL(request.url).origin !== new URL(url).origin) throw new Error("ADMIN_DATABASE_ORIGIN_DENIED");
  if (key.startsWith("sb_secret_") && headers.get("authorization") === `Bearer ${key}`) headers.delete("authorization");
  headers.set("apikey", key);
  return fetch(new Request(request, { headers }));
 };
 const options = { auth: { persistSession: false, autoRefreshToken: false } };
 const raw = createClient(url, key, { ...options, global: { fetch: transport } });
 return createClient(url, key, { ...options, global: { fetch: auditedAdminFetch(actor, permission, async (name,args) => await raw.rpc(name,args), transport) } }) as any;
}
