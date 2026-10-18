import { mailLocale } from "./mail-locale.ts";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function contactAdmin(userId: string) {
  const client = await db();
  const [userResult, adminResult] = await Promise.all([
    client.auth.admin.getUserById(userId),
    client
      .from("platform_admins")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
  ]);
  const user = userResult.data?.user,
    admin = adminResult.data;
  if (
    userResult.error ||
    adminResult.error ||
    user?.app_metadata?.corporate_admin !== true ||
    !admin ||
    (admin.role !== "owner" && admin.permissions?.mail !== true)
  )
    throw new Error("FORBIDDEN");
  return client;
}
async function audit(
  client: any,
  userId: string,
  action: string,
  id: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await client
    .from("platform_admin_audit_log")
    .insert({
      actor_user_id: userId,
      action,
      target_type: "contact_message",
      target_id: id,
      result: "success",
      details,
    });
  if (error) throw new Error("AUDIT_FAILED");
}

export const submitContact = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      email: string;
      subject: string;
      message: string;
      category: string;
      locale: string;
      website: string;
      captchaToken: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (data.website) throw new Error("SPAM");
    if (
      data.name.trim().length < 2 ||
      data.name.trim().length > 100 ||
      data.subject.trim().length < 3 ||
      data.subject.trim().length > 160 ||
      data.message.trim().length < 20 ||
      data.message.trim().length > 3000 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)
    )
      throw new Error("INVALID");
    const secret = process.env["TURNSTILE_SECRET_KEY"]?.trim();
    if (secret) {
      if (!data.captchaToken || data.captchaToken.length > 2048) throw new Error("CAPTCHA");
      const body = new URLSearchParams({ secret, response: data.captchaToken });
      let check: Response;
      try {
        check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body,
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        throw new Error("CAPTCHA_UNAVAILABLE");
      }
      if (!check.ok) throw new Error("CAPTCHA_UNAVAILABLE");
      const result = (await check.json()) as { success?: boolean; action?: string };
      if (result.success !== true || result.action !== "contact") throw new Error("CAPTCHA");
    } else if (process.env["NODE_ENV"] === "production") throw new Error("CAPTCHA_UNAVAILABLE");
    const categories = [
      "question",
      "support",
      "feedback",
      "complaint",
      "privacy",
      "billing",
      "agency",
    ];
    if (!categories.includes(data.category)) throw new Error("INVALID");
    const client = await db();
    const { data: saved, error } = await client
      .from("contact_messages")
      .insert({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        category: data.category,
        locale: mailLocale(data.locale ?? "nl"),
      })
      .select("id")
      .single();
    if (error) throw new Error("SAVE_FAILED");
    const { data: admins } = await client
      .from("platform_admins")
      .select("user_id")
      .eq("active", true);
    if (admins?.length)
      await client
        .from("notifications")
        .insert(
          admins.map((admin: any) => ({
            user_id: admin.user_id,
            kind: "account",
            title: "Nieuw contactverzoek / New contact request",
            body: `contact|${data.category}|${data.subject.trim()}`,
            event_key: `contact:${saved.id}`,
            link: "/corporate-admin/contact",
          })),
        );
    return { ok: true };
  });

export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await contactAdmin(context.userId);
    const { data, error } = await client
      .from("contact_messages")
      .select(
        "id,name,email,subject,message,category,locale,status,created_at,updated_at,handled_by,closed_at,retention_hold,retention_hold_reason,content_reports(url,location,child_safety_exception,receipt:email_outbox(status),content_report_decisions(id,created_at,decision,reporter_mail:email_outbox!reporter_email_id(status),affected_mail:email_outbox!affected_email_id(status)))",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("CONTACT_LIST_FAILED");
    const role = await client.from("platform_admins").select("role").eq("user_id", context.userId).eq("active", true).maybeSingle();
    if (role.error) throw new Error("CONTACT_LIST_FAILED");
    return (data ?? []).map((row: any) => ({ ...row,
      content_reports: row.content_reports ? { ...row.content_reports,
        content_report_decisions: [...(row.content_reports.content_report_decisions ?? [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)) } : null,
      can_decide_content_report: role.data?.role === "owner" }));
  });

export const updateContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; status: "new" | "reviewing" | "answered" | "closed" }) => input)
  .handler(async ({ data, context }) => {
    if (
      !/^[0-9a-f-]{36}$/i.test(data.id) ||
      !["new", "reviewing", "answered", "closed"].includes(data.status)
    )
      throw new Error("INVALID");
    const client = await contactAdmin(context.userId);
    if (["closed", "answered"].includes(data.status)) {
      const report = await client.from("content_reports").select("contact_id").eq("contact_id", data.id).maybeSingle();
      if (report.error) throw new Error("CONTACT_UPDATE_FAILED");
      if (report.data) throw new Error("CONTENT_REPORT_REQUIRES_DECISION");
    }
    const { data: previous, error: readError } = await client
      .from("contact_messages")
      .select("status")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error("CONTACT_NOT_FOUND");
    const { error } = await client
      .from("contact_messages")
      .update({
        status: data.status,
        handled_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error("CONTACT_UPDATE_FAILED");
    await audit(client, context.userId, "contact.status.update", data.id, {
      from: previous.status,
      to: data.status,
    });
    return { ok: true };
  });

export const updateContactRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; hold: boolean; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id) || typeof data.hold !== "boolean" ||
      typeof data.reason !== "string" || (data.hold && (data.reason.trim().length < 10 || data.reason.trim().length > 500)))
      throw new Error("INVALID");
    const client = await contactAdmin(context.userId);
    const { data: updated, error } = await client.from("contact_messages")
      .update({ retention_hold: data.hold, retention_hold_reason: data.hold ? data.reason.trim() : null,
        handled_by: context.userId, updated_at: new Date().toISOString() })
      .eq("id", data.id).select("id").single();
    if (error || !updated) throw new Error("CONTACT_UPDATE_FAILED");
    await audit(client, context.userId, "contact.retention.hold", data.id, { hold: data.hold });
    return { ok: true };
  });
