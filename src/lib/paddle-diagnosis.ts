export type PaddleDiagnosisState =
  | "not_recorded" | "not_paid" | "webhook_failed" | "missing_entitlement"
  | "entitlement_expired" | "subscription_missing" | "workspace_mismatch"
  | "workspace_conflict" | "active";

export function classifyPaddleDiagnosis(input: {
  transactionStatus?: string | null;
  webhookFailed: boolean;
  workspaceConflict?: boolean;
  billingMode?: string | null;
  expectedPlan?: string | null;
  workspacePlan?: string | null;
  entitlementEndsAt?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
}, now = Date.now()): PaddleDiagnosisState {
  if (input.workspaceConflict) return "workspace_conflict";
  if (input.webhookFailed) return "webhook_failed";
  if (!input.transactionStatus) return "not_recorded";
  if (!["completed", "paid"].includes(input.transactionStatus)) return "not_paid";
  if (input.billingMode === "one_time") {
    if (!input.entitlementEndsAt) return "missing_entitlement";
    if (new Date(input.entitlementEndsAt).getTime() <= now) return "entitlement_expired";
    return input.workspacePlan === input.expectedPlan || input.workspacePlan === "agency" ? "active" : "workspace_mismatch";
  }
  if (!input.subscriptionStatus || !["active", "trialing", "past_due"].includes(input.subscriptionStatus))
    return "subscription_missing";
  if (input.workspacePlan !== input.subscriptionPlan) return "workspace_mismatch";
  return "active";
}
