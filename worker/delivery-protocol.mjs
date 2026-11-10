import { createHash } from "node:crypto";
export function requireClaim(message) {
 if (!/^[0-9a-f-]{36}$/i.test(message?.claim_token || "")) throw Object.assign(new Error("DELIVERY_CLAIM_REQUIRED"), { code: "DELIVERY_CLAIM_REQUIRED" });
 return message.claim_token;
}
export async function beginDelivery(rpc, kind, message) {
 const token = requireClaim(message);
 if (await rpc("begin_queue_delivery", { p_kind: kind, p_id: message.id, p_token: token }) !== true)
  throw Object.assign(new Error("DELIVERY_CLAIM_LOST"), { code: "DELIVERY_CLAIM_LOST" });
}
export async function finishDelivery(rpc, kind, message, status, error = null, gone = false) {
 const token = requireClaim(message);
 if (await rpc("complete_queue_delivery", { p_kind: kind, p_id: message.id, p_token: token, p_status: status, p_error: error, p_gone: gone }) !== true)
  throw Object.assign(new Error("DELIVERY_ACK_UNCONFIRMED"), { code: "DELIVERY_ACK_UNCONFIRMED" });
}
function canonical(value) {
 if (Array.isArray(value)) return value.map(canonical);
 if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
 return value;
}
export function deliveryDigest(body) {
 const { claimToken: _claim, ...content } = body;
 if (content.smtp) { const { password: _password, ...smtp } = content.smtp; content.smtp = smtp; }
 return createHash("sha256").update(JSON.stringify(canonical(content))).digest("hex");
}
export async function durableRelaySend({ reserve, accept, send }) {
 const state = await reserve();
 if (state === "accepted") return;
 if (state !== "reserved") throw Object.assign(new Error("DELIVERY_OUTCOME_UNCONFIRMED"), { code: "DELIVERY_OUTCOME_UNCONFIRMED" });
 await send();
 if (await accept() !== true) throw Object.assign(new Error("DELIVERY_OUTCOME_UNCONFIRMED"), { code: "DELIVERY_OUTCOME_UNCONFIRMED" });
}
