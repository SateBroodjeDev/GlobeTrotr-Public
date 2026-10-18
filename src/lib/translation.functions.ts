import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchTranslationDraft } from "@/lib/translation-provider.server";

const requestTranslationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { text: string; source: "nl" | "en"; target: "nl" | "en" }) => {
    if (
      !input ||
      typeof input.text !== "string" ||
      !["nl", "en"].includes(input.source) ||
      !["nl", "en"].includes(input.target)
    )
      throw new Error("INVALID_TRANSLATION_REQUEST");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: user }, { data: admin }] = await Promise.all([
      db.auth.admin.getUserById(context.userId),
      db
        .from("platform_admins")
        .select("role,permissions")
        .eq("user_id", context.userId)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (
      user.user?.app_metadata?.corporate_admin !== true ||
      !admin ||
      (admin.role !== "owner" &&
        admin.permissions?.issues !== true &&
        admin.permissions?.operations !== true)
    )
      throw new Error("FORBIDDEN");
    return fetchTranslationDraft({
      ...data,
      endpoint: process.env.TRANSLATION_API_URL,
      apiKey: process.env.TRANSLATION_API_KEY,
    });
  });

// Expected provider failures cross the server boundary as safe codes, so the
// production error sanitizer cannot hide the category from the draft editor.
export async function createTranslationDraft(input: Parameters<typeof requestTranslationDraft>[0]) {
  const result = await requestTranslationDraft(input);
  if (result.errorCode) throw new Error(result.errorCode);
  return { translated: result.translated };
}
