import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIVACY_PURPOSE_VERSION, type SyncedPrivacyChoice } from "./privacy-sync";

function fromRow(row: any): SyncedPrivacyChoice | null {
  return row ? { preferences: row.preferences, analytics: row.analytics, purposeVersion: row.purpose_version,
    decidedAt: row.decided_at, accountLinked: true } : null;
}
export const getAccountPrivacyChoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).from("account_privacy_choices")
      .select("preferences,analytics,purpose_version,decided_at").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("PRIVACY_SYNC_FAILED");
    return fromRow(data);
  });
export const saveAccountPrivacyChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { preferences: boolean; analytics: boolean; decidedAt?: string }) => {
    if (typeof input?.preferences !== "boolean" || typeof input?.analytics !== "boolean") throw new Error("INVALID_PRIVACY_CHOICE");
    const decidedAt = input.decidedAt ?? new Date().toISOString();
    if (typeof decidedAt !== "string" || !Number.isFinite(Date.parse(decidedAt)) || Date.parse(decidedAt) > Date.now() + 60_000 ||
      Date.now() - Date.parse(decidedAt) >= 365 * 86400_000) throw new Error("INVALID_PRIVACY_CHOICE");
    return { preferences: input.preferences, analytics: input.analytics, decided_at: decidedAt };
  }).handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).from("account_privacy_choices")
      .upsert({ user_id: context.userId, ...data, purpose_version: PRIVACY_PURPOSE_VERSION })
      .select("preferences,analytics,purpose_version,decided_at").single();
    if (error) throw new Error("PRIVACY_SYNC_FAILED");
    return fromRow(row)!;
  });
