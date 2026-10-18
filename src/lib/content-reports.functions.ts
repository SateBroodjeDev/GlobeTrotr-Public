import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contentReportLanguage, decisionMessage, validateContentDecision, validateContentNotice, type ContentDecision, type ContentNotice } from "./content-reports";

export const submitContentReport = createServerFn({ method: "POST" })
  .validator((input: ContentNotice & { website: string; captchaToken: string }) => input)
  .handler(async ({ data }) => {
    const notice = validateContentNotice(data);
    if (data.website || typeof data.captchaToken !== "string" || data.captchaToken.length > 2048) throw new Error("INVALID_NOTICE");
    const secret = process.env["TURNSTILE_SECRET_KEY"]?.trim();
    if (secret) {
      const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", body: new URLSearchParams({ secret, response: data.captchaToken }), signal: AbortSignal.timeout(8000),
      });
      const result = check.ok ? await check.json() : null;
      if (result?.success !== true || result.action !== "contact") throw new Error("CAPTCHA");
    } else if (process.env["NODE_ENV"] === "production") throw new Error("CAPTCHA_UNAVAILABLE");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await (supabaseAdmin as any).rpc("submit_content_report", { p_notice: notice });
    if (error) throw new Error("NOTICE_SAVE_FAILED");
    return { id: saved as string, emailQueued: Boolean(notice.email) };
  });

export const decideContentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: ContentDecision) => input)
  .handler(async ({ data, context }) => {
    const decision = validateContentDecision(data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [user, admin] = await Promise.all([db.auth.admin.getUserById(context.userId),
      db.from("platform_admins").select("role").eq("user_id", context.userId).eq("active", true).maybeSingle()]);
    if (user.error || admin.error || user.data?.user?.app_metadata?.corporate_admin !== true || admin.data?.role !== "owner") throw new Error("FORBIDDEN");
    let affectedEmail = "", affectedLocale = "nl";
    if (decision.affectedUserId) {
      const recipient = await db.auth.admin.getUserById(decision.affectedUserId);
      if (recipient.error || !recipient.data?.user?.email) throw new Error("AFFECTED_USER_NOT_CONTACTABLE");
      affectedEmail = recipient.data.user.email;
      const profile = await db.from("profiles").select("locale").eq("id", decision.affectedUserId).maybeSingle();
      if (profile.error) throw new Error("AFFECTED_USER_NOT_CONTACTABLE");
      affectedLocale = contentReportLanguage(profile.data?.locale);
    }
    const { data: report, error: readError } = await db.from("contact_messages").select("locale").eq("id", decision.id).single();
    if (readError) throw new Error("NOTICE_NOT_FOUND");
    const { error } = await db.rpc("decide_content_report", { p_id: decision.id, p_actor: context.userId, p_decision: decision,
      p_reporter_body: decisionMessage(decision, report.locale), p_affected_body: decisionMessage(decision, affectedLocale),
      p_affected_email: affectedEmail, p_affected_locale: affectedLocale });
    if (error) throw new Error("DECISION_SAVE_FAILED");
    return { ok: true };
  });
