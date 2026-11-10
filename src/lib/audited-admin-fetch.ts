type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
/** Per-client closure: never change headers on a shared service-role singleton. */
export function auditedAdminFetch(actor: string, permission: string, rpc: Rpc, transport: typeof fetch): typeof fetch {
 let contract: Promise<void> | undefined;
 const verify = () => contract ??= (async () => {
  const result = await rpc("verify_admin_audit_contract", { p_actor: actor, p_permission: permission });
  if (result.error || result.data !== true) throw new Error("ADMIN_AUDIT_CONTRACT_REQUIRED");
 })();
 return async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (!mutating) return transport(request);
  const headers = new Headers(request.headers);
  headers.set("x-globetrotr-admin-actor", actor);
  headers.set("x-globetrotr-admin-capability", permission);
  if (url.pathname.startsWith("/rest/v1/")) {
   if (!url.pathname.endsWith("/platform_admin_audit_log")) await verify();
   return transport(new Request(request, { headers }));
  }
  if (url.pathname.startsWith("/auth/v1/") || url.pathname.startsWith("/storage/v1/")) {
   await verify();
   const op = url.pathname.startsWith("/auth/") ? "auth.action" : "storage.action";
   const begin = await rpc("begin_admin_effect", { p_actor: actor, p_permission: permission, p_operation: op, p_target: url.pathname.split("/").find(part => /^[0-9a-f-]{36}$/i.test(part)) ?? null });
   if (begin.error || typeof begin.data !== "string") throw new Error("ADMIN_EFFECT_INTENT_REQUIRED");
   let response: Response;
   try { response = await transport(new Request(request, { headers })); }
   catch {
    await rpc("finish_admin_effect", { p_actor: actor, p_id: begin.data, p_state: "uncertain" });
    throw new Error("ADMIN_EFFECT_OUTCOME_UNCONFIRMED");
   }
   const ended = await rpc("finish_admin_effect", { p_actor: actor, p_id: begin.data, p_state: response.ok ? "confirmed" : "uncertain" });
   if (ended.error || ended.data !== true) throw new Error("ADMIN_EFFECT_OUTCOME_UNCONFIRMED");
   return response;
  }
  throw new Error("ADMIN_EFFECT_TARGET_DENIED");
 };
}
export async function runAdminEffect<T>(db: { rpc: Rpc }, actor: string, permission: string, operation: string, target: string | null, effect: () => Promise<T>): Promise<T> {
 const begun = await db.rpc("begin_admin_effect", { p_actor: actor, p_permission: permission, p_operation: operation, p_target: target });
 if (begun.error || typeof begun.data !== "string") throw new Error("ADMIN_EFFECT_INTENT_REQUIRED");
 let value: T;
 try { value = await effect(); }
 catch {
  await db.rpc("finish_admin_effect", { p_actor: actor, p_id: begun.data, p_state: "uncertain" });
  throw new Error("ADMIN_EFFECT_OUTCOME_UNCONFIRMED");
 }
 const ended = await db.rpc("finish_admin_effect", { p_actor: actor, p_id: begun.data, p_state: value instanceof Response && !value.ok ? "uncertain" : "confirmed" });
 if (ended.error || ended.data !== true) throw new Error("ADMIN_EFFECT_OUTCOME_UNCONFIRMED");
 return value;
}
