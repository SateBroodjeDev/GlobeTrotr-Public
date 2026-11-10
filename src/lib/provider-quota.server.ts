import type { PlanId } from "./types";
import { providerDailyLimit, type MeteredProvider } from "./infrastructure-policy";

type QuotaResult = { allowed?: boolean; reason?: string; used?: number; remaining?: number; limit?: number };

export async function consumeProviderQuota(
  db: any,
  workspaceId: string,
  actorUserId: string,
  plan: PlanId,
  provider: MeteredProvider,
) {
  const limit = providerDailyLimit(plan, provider);
  const { data, error } = await db.rpc("consume_external_api_quota", {
    p_workspace_uuid: workspaceId,
    p_actor_user_id: actorUserId,
    p_provider: provider,
    p_daily_limit: limit,
  });
  if (error) {
    console.error(`[Provider quota] ${provider} kon niet worden gecontroleerd: ${error.code ?? "unknown"}`);
    throw new Error("PROVIDER_QUOTA_UNAVAILABLE");
  }
  const result = data as QuotaResult;
  if (!result?.allowed) {
    throw new Error(result?.reason === "provider_disabled" ? "PROVIDER_DISABLED" : "PROVIDER_QUOTA_EXCEEDED");
  }
  return result;
}
