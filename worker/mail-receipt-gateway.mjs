import { timingSafeEqual } from "node:crypto";
const endpoint = "http://worker:9091/internal/mail-receipts";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const failure = code => Object.assign(new Error(code), { code });
export function receiptAuthorized(header, token) {
 if (!token || token.length < 32 || typeof header !== "string") return false;
 const a = Buffer.from(header), b = Buffer.from(`Bearer ${token}`);
 return a.length === b.length && timingSafeEqual(a, b);
}
export async function mailReceiptAction(body, rpc) {
 if (!body || typeof body !== "object" || Array.isArray(body)) throw failure("INVALID_RECEIPT_REQUEST");
 if (body.action === "check" && Object.keys(body).length === 1) {
  if (await rpc("verify_mail_receipt_contract", {}) !== true) throw failure("DELIVERY_LEDGER_UNAVAILABLE");
  return true;
 }
 if (!["reserve", "accept"].includes(body.action) || !["email", "corporate"].includes(body.kind)
  || typeof body.id !== "string" || typeof body.digest !== "string" || !uuid.test(body.id) || !digest.test(body.digest)
  || Object.keys(body).some(key => !["action", "kind", "id", "digest", "claimToken"].includes(key))) throw failure("INVALID_RECEIPT_REQUEST");
 if (body.action === "reserve") {
  if (typeof body.claimToken !== "string" || !uuid.test(body.claimToken)) throw failure("INVALID_RECEIPT_REQUEST");
  const value = await rpc("reserve_mail_receipt", { p_kind: body.kind, p_id: body.id, p_token: body.claimToken, p_digest: body.digest });
  if (!["reserved", "accepted", "uncertain"].includes(value)) throw failure("DELIVERY_LEDGER_UNAVAILABLE");
  return value;
 }
 if (body.claimToken !== undefined) throw failure("INVALID_RECEIPT_REQUEST");
 if (await rpc("accept_mail_receipt", { p_kind: body.kind, p_id: body.id, p_digest: body.digest }) !== true) throw failure("DELIVERY_OUTCOME_UNCONFIRMED");
 return true;
}
export function mailReceiptClient(token, transport = fetch) {
 if (!token || token.length < 32) throw failure("MAIL_RELAY_TOKEN_INVALID");
 return async body => {
  let response;
  try {
   response = await transport(endpoint, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
   if (!response.ok) throw failure("DELIVERY_LEDGER_UNAVAILABLE");
   const value = await response.json();
   if (body.action === "check" || body.action === "accept") { if (value !== true) throw failure("DELIVERY_LEDGER_UNAVAILABLE"); }
   else if (!["reserved", "accepted", "uncertain"].includes(value)) throw failure("DELIVERY_LEDGER_UNAVAILABLE");
   return value;
  } catch { throw failure("DELIVERY_LEDGER_UNAVAILABLE"); }
 };
}
export function maintenanceHold(env) {
 if (![undefined, "", "true", "false"].includes(env.V1_MAINTENANCE_HOLD)) throw failure("INVALID_MAINTENANCE_HOLD");
 return env.V1_MAINTENANCE_HOLD === "true";
}

export async function receiptRequest({ method, authorization, token, hold, body, rpc }) {
 if (method !== "POST") return { status: 405 };
 if (!receiptAuthorized(authorization, token)) return { status: 401 };
 if (hold && body?.action !== "check") return { status: 503 };
 try { return { status: 200, value: await mailReceiptAction(body, rpc) }; }
 catch { return { status: 503, value: { error: "RECEIPT_UNAVAILABLE" } }; }
}

export function maintenanceValidation(env) {
 if (![undefined, "", "true", "false"].includes(env.V1_MAINTENANCE_VALIDATE)) throw failure("INVALID_MAINTENANCE_VALIDATION");
 if (env.V1_MAINTENANCE_VALIDATE === "true" && maintenanceHold(env)) throw failure("CONFLICTING_MAINTENANCE_MODES");
 return env.V1_MAINTENANCE_VALIDATE === "true";
}

// Missing flags, lost configuration and DB failures never override the durable gate.
export async function workerExecutionMode(rpc, { hold = false, validation = false } = {}) {
 if (hold) return "hold";
 try {
  const mode = await rpc("get_v1_maintenance_mode", {});
  if (mode === "open" && !validation) return "live";
  if (mode === "validation" && validation) return "validation";
 } catch { /* fixed hold result; no raw database exception */ }
 return "hold";
}
