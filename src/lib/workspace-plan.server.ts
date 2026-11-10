import type { WorkspaceState } from "./types";

type PlanDatabase = { from: (table: string) => any; rpc: (name: string, input: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
type PlanUpdate = { userId: string; plan: string; planMode?: "manual" | "automatic"; planChange?: boolean; reason: string };

export async function savePlatformPlan(db: PlanDatabase, actor: string, currentPlan: string, data: PlanUpdate) {
  // A profile edit must not reassert a stale plan or create a new manual grant.
  if (data.planChange === false || data.planMode === undefined && data.plan === currentPlan) return;
  const { error } = await db.rpc("set_workspace_plan_override", {
    p_actor: actor, p_user: data.userId,
    p_plan: data.planMode === "automatic" ? null : data.plan, p_reason: data.reason.trim(),
  });
  if (error) throw error;
}

export async function persistWorkspaceWithoutPlanOverwrite(db: Pick<PlanDatabase, "from">, userId: string, workspace: Partial<WorkspaceState>) {
  const { data: stored, error: readError } = await db.from("workspaces").select("plan").eq("user_id", userId).maybeSingle();
  if (readError) throw readError;
  const plan = ["free", "pro", "agency"].includes(stored?.plan ?? "") ? stored.plan : "free";
  const baseCurrency = typeof workspace.baseCurrency === "string" && /^[A-Z]{3}$/.test(workspace.baseCurrency) ? workspace.baseCurrency : "EUR";
  const { error } = await db.from("workspaces").upsert({
    user_id: userId,
    data: { ...workspace, plan },
    // Do not write the plan column: a provider or administrator may have changed
    // it since the read. The database guard synchronizes data.plan to that column.
    base_currency: baseCurrency,
    branding: workspace.branding ?? {},
  }, { onConflict: "user_id" });
  if (error) throw error;
  return { ok: true };
}
