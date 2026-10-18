import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveAgencyPermissions } from "./agency-permissions";
import { emptyInvoiceParty, normalizeInvoiceParty, requireInvoiceParty, invoiceTotals, invoiceCurrencies,
  type InvoiceParty, type InvoiceLine, type InvoiceTaxMode } from "./invoice-administration";
import { invoiceLedgerCsv } from "./invoice-document";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function database() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin as any; }
async function access(db: any, actor: string, scope: "account" | "agency") {
  if (!["account", "agency"].includes(scope)) throw new Error("INVOICE_SCOPE_INVALID");
  const owned = await db.from("workspaces").select("workspace_uuid,plan").eq("user_id", actor).maybeSingle();
  if (owned.error) throw new Error("INVOICE_ACCESS_FAILED");
  if (owned.data && (scope === "account" || owned.data.plan === "agency")) return owned.data.workspace_uuid as string;
  if (scope === "account") throw new Error("BILLING_OWNER_REQUIRED");
  const member = await db.from("workspace_members").select("workspace_uuid,role,permission_overrides").eq("user_id", actor).eq("status", "active").in("role", ["advisor", "finance"]).maybeSingle();
  if (member.error || !member.data) throw new Error("AGENCY_PERMISSION_REQUIRED");
  const [workspace, defaults] = await Promise.all([
    db.from("workspaces").select("plan").eq("workspace_uuid", member.data.workspace_uuid).single(),
    db.from("agency_role_permissions").select("permissions").eq("workspace_uuid", member.data.workspace_uuid).eq("role", member.data.role).maybeSingle(),
  ]);
  if (workspace.error || defaults.error || workspace.data?.plan !== "agency"
    || !effectiveAgencyPermissions(member.data.role, defaults.data?.permissions, member.data.permission_overrides).billing_manage) throw new Error("AGENCY_PERMISSION_REQUIRED");
  return member.data.workspace_uuid as string;
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const getInvoiceAdministration = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .validator((input: { scope: "account" | "agency"; offset?: number }) => input)
  .handler(async ({ data, context }) => {
    const db = await database(), workspaceId = await access(db, context.userId, data.scope);
    const offset = data.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Error("INVOICE_PAGE_INVALID");
    const profile = await db.from("workspace_invoice_profiles").select("details,paddle_synced_at").eq("workspace_uuid", workspaceId).maybeSingle();
    if (profile.error) throw new Error("INVOICE_PROFILE_LOAD_FAILED");
    if (data.scope === "account") return { workspaceId, profile: { ...emptyInvoiceParty, ...profile.data?.details } as InvoiceParty, clients: [] as any[], invoices: [] as any[] };
    const [clients, invoices] = await Promise.all([
      db.from("agency_clients").select("id,full_name,email,billing_profile").eq("workspace_uuid", workspaceId).eq("status", "active").order("full_name").limit(500),
      db.from("agency_invoices").select("*").eq("workspace_uuid", workspaceId).order("created_at", { ascending: false }).order("id").range(offset, offset + 249),
    ]);
    if (clients.error || invoices.error) throw new Error("INVOICE_LOAD_FAILED");
    return { workspaceId, profile: { ...emptyInvoiceParty, ...profile.data?.details } as InvoiceParty, clients: clients.data ?? [], invoices: invoices.data ?? [] };
  });
export const exportAgencyInvoiceLedger = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await database(), workspaceId = await access(db, context.userId, "agency");
    const through = new Date().toISOString(), invoices: any[] = [];
    for (let offset = 0; offset <= 100000; offset += 1000) {
      const result = await db.from("agency_invoices").select("id,invoice_number,invoice_date,kind,credit_for_invoice,credit_original_number,currency,recipient,net_minor,vat_minor,total_minor").eq("workspace_uuid", workspaceId).lte("created_at", through)
        .order("created_at").order("id").range(offset, offset + 999);
      if (result.error) throw new Error("INVOICE_EXPORT_FAILED");
      if (offset === 100000 && result.data?.length) throw new Error("INVOICE_EXPORT_LIMIT");
      invoices.push(...result.data ?? []);
      if (!result.data?.length || result.data.length < 1000) return { csv: invoiceLedgerCsv(invoices), count: invoices.length };
    }
    throw new Error("INVOICE_EXPORT_LIMIT");
  });
export const saveInvoiceBusinessProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { scope: "account" | "agency"; profile: InvoiceParty }) => input)
  .handler(async ({ data, context }) => {
    const db = await database(), workspaceId = await access(db, context.userId, data.scope), profile = normalizeInvoiceParty(data.profile);
    const result = await db.from("workspace_invoice_profiles").upsert({ workspace_uuid: workspaceId, details: profile, paddle_synced_at: null, updated_at: new Date().toISOString() });
    if (result.error) throw new Error("INVOICE_PROFILE_SAVE_FAILED");
    return { ok: true };
  });
export const issueAgencyCustomerInvoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { clientId: string; requestId: string; recipient: InvoiceParty; lines: InvoiceLine[]; currency: string;
    serviceDate: string; dueDate: string; taxMode: InvoiceTaxMode; taxNote: string; notes: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.clientId) || !uuid.test(data.requestId) || !invoiceCurrencies.includes(data.currency)
      || !validDate(data.serviceDate) || !validDate(data.dueDate) || typeof data.taxNote !== "string" || data.taxNote.length > 500
      || typeof data.notes !== "string" || data.notes.length > 2000) throw new Error("INVOICE_INVALID");
    const db = await database(), workspaceId = await access(db, context.userId, "agency");
    const profile = await db.from("workspace_invoice_profiles").select("details").eq("workspace_uuid", workspaceId).single();
    if (profile.error) throw new Error("INVOICE_ISSUER_REQUIRED");
    const issuer = normalizeInvoiceParty(profile.data.details), recipient = normalizeInvoiceParty(data.recipient);
    requireInvoiceParty(issuer, true, data.taxMode); requireInvoiceParty(recipient, false, data.taxMode);
    const totals = invoiceTotals(data.lines, data.taxMode, data.taxNote);
    const document = { kind: "invoice", issuer, recipient, ...totals, currency: data.currency, serviceDate: data.serviceDate,
      dueDate: data.dueDate, taxMode: data.taxMode, taxNote: data.taxNote.trim(), notes: data.notes.trim() };
    const result = await db.rpc("issue_agency_invoice", { p_workspace_id: workspaceId, p_actor_id: context.userId, p_client_id: data.clientId, p_request_id: data.requestId, p_document: document });
    if (result.error) throw new Error("INVOICE_ISSUE_FAILED");
    // Separate reusable recipient details from the immutable issued snapshot.
    const client = await db.from("agency_clients").update({ billing_profile: recipient }).eq("id", data.clientId).eq("workspace_uuid", workspaceId);
    return { invoice: result.data, clientProfileSaved: !client.error };
  });
export const creditAgencyCustomerInvoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: { invoiceId: string; requestId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.invoiceId) || !uuid.test(data.requestId) || typeof data.reason !== "string" || data.reason.trim().length < 5 || data.reason.length > 2000) throw new Error("CREDIT_REASON_REQUIRED");
    const db = await database(), workspaceId = await access(db, context.userId, "agency");
    const original = await db.from("agency_invoices").select("client_id").eq("id", data.invoiceId).eq("workspace_uuid", workspaceId).eq("kind", "invoice").single();
    if (original.error) throw new Error("CREDIT_ORIGINAL_REQUIRED");
    const result = await db.rpc("issue_agency_invoice", { p_workspace_id: workspaceId, p_actor_id: context.userId, p_client_id: original.data.client_id, p_request_id: data.requestId,
      p_document: { kind: "credit", creditFor: data.invoiceId, dueDate: new Date().toISOString().slice(0, 10), notes: data.reason.trim() } });
    if (result.error) throw new Error("CREDIT_ISSUE_FAILED");
    return { invoice: result.data };
  });
