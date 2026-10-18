import { normalizeInvoiceParty, paddleBusinessPayload } from "./invoice-administration.ts";

/** Customer IDs come exclusively from the authenticated workspace, never from browser input. */
export async function preparePaddleBusiness(db: any, workspaceId: string, email: string, apiKey: string, base: string) {
  const profile = await db.from("workspace_invoice_profiles").select("*").eq("workspace_uuid", workspaceId).maybeSingle();
  if (profile.error) throw new Error("INVOICE_PROFILE_LOAD_FAILED");
  if (!profile.data?.details?.legalName) return null;
  const party = normalizeInvoiceParty(profile.data.details), business = paddleBusinessPayload(party);
  if (!apiKey || !email) throw new Error("PADDLE_BUSINESS_NOT_CONFIGURED");
  const customer = await db.from("billing_customers").select("provider_customer_id").eq("workspace_uuid", workspaceId).maybeSingle();
  if (customer.error) throw new Error("PADDLE_CUSTOMER_LOAD_FAILED");
  async function create(path: string, body: unknown, prefix: "ctm" | "add" | "biz") {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`PADDLE_BUSINESS_${response.status}`);
    const result = await response.json();
    if (typeof result.data?.id !== "string" || !new RegExp(`^${prefix}_[a-z0-9]+$`, "i").test(result.data.id)) throw new Error("PADDLE_BUSINESS_RESPONSE_INVALID");
    return result.data.id as string;
  }
  let customerId = customer.data?.provider_customer_id as string | undefined;
  if (!customerId) {
    customerId = await create("/customers", { email }, "ctm");
    const saved = await db.from("billing_customers").upsert({ workspace_uuid: workspaceId, provider_customer_id: customerId, billing_email: email }, { onConflict: "workspace_uuid" });
    if (saved.error) throw new Error("PADDLE_CUSTOMER_SAVE_FAILED");
  }
  if (!/^ctm_[a-z0-9]+$/i.test(customerId)) throw new Error("PADDLE_CUSTOMER_INVALID");
  if (profile.data.paddle_synced_at && profile.data.paddle_customer_id === customerId && profile.data.paddle_business_id && profile.data.paddle_address_id) {
    if (!/^biz_[a-z0-9]+$/i.test(profile.data.paddle_business_id) || !/^add_[a-z0-9]+$/i.test(profile.data.paddle_address_id)) throw new Error("PADDLE_BUSINESS_RESPONSE_INVALID");
    return { customer: { id: customerId }, business: { id: profile.data.paddle_business_id }, address: { id: profile.data.paddle_address_id } };
  }
  const addressId = await create(`/customers/${customerId}/addresses`, { first_line: party.address, city: party.city,
    postal_code: party.postalCode, region: party.region || null, country_code: party.country }, "add");
  const businessId = await create(`/customers/${customerId}/businesses`, business, "biz");
  const saved = await db.from("workspace_invoice_profiles").update({ paddle_customer_id: customerId, paddle_business_id: businessId,
    paddle_address_id: addressId, paddle_synced_at: new Date().toISOString() }).eq("workspace_uuid", workspaceId).eq("updated_at", profile.data.updated_at).select("workspace_uuid").maybeSingle();
  if (saved.error || !saved.data) throw new Error("PADDLE_BUSINESS_SAVE_FAILED");
  return { customer: { id: customerId }, business: { id: businessId }, address: { id: addressId } };
}
