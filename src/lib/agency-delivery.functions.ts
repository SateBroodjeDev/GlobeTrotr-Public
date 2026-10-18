import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agencyHostLookup } from "@/lib/agency-domain";
export type AgencyDeliverySettings = {
  workspaceId: string;
  subdomain: string;
  customDomain: string;
  domainStatus: "unconfigured" | "pending" | "verified" | "failed";
  verificationToken: string;
  turnstileConfigured: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  mailStatus: "unconfigured" | "pending" | "verified" | "failed";
  smtpConfigured: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordSet: boolean;
  smtpTestStatus: "untested" | "ok" | "failed";
  smtpTestedAt: string;
};
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function workspace(client: any, user: string) {
  const { data } = await client
    .from("workspaces")
    .select("workspace_uuid,plan")
    .eq("user_id", user)
    .maybeSingle();
  if (data?.plan !== "agency") throw new Error("AGENCY_OWNER_REQUIRED");
  return data.workspace_uuid as string;
}
export const getAgencyDeliverySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const [{ data: d }, { data: m }, { data: s }] = await Promise.all([
      client
        .from("agency_domains")
        .select("subdomain,custom_domain,verification_status,verification_token,turnstile_hostname_confirmed")
        .eq("workspace_uuid", id)
        .maybeSingle(),
      client
        .from("agency_mail_settings")
        .select(
          "from_name,from_email,reply_to,verification_status,smtp_secret_ref,smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password_ciphertext,smtp_test_status,smtp_tested_at",
        )
        .eq("workspace_uuid", id)
        .maybeSingle(),
      client
        .from("agency_settings")
        .select("system_name,contact_email")
        .eq("workspace_uuid", id)
        .maybeSingle(),
    ]);
    return {
      workspaceId: id,
      subdomain: d?.subdomain ?? "",
      customDomain: d?.custom_domain ?? "",
      domainStatus: d?.verification_status ?? "unconfigured",
      verificationToken: d?.verification_token ?? "",
      turnstileConfigured: Boolean(d?.turnstile_hostname_confirmed),
      fromName: m?.from_name ?? s?.system_name ?? "",
      fromEmail: m?.from_email ?? s?.contact_email ?? "",
      replyTo: m?.reply_to ?? s?.contact_email ?? "",
      mailStatus: m?.verification_status ?? "unconfigured",
      smtpConfigured: Boolean(m?.smtp_secret_ref),
      smtpHost: m?.smtp_host ?? "",
      smtpPort: Number(m?.smtp_port ?? 587),
      smtpSecure: Boolean(m?.smtp_secure),
      smtpUsername: m?.smtp_username ?? "",
      smtpPasswordSet: Boolean(m?.smtp_password_ciphertext),
      smtpTestStatus: m?.smtp_test_status ?? "untested",
      smtpTestedAt: m?.smtp_tested_at ?? "",
    } as AgencyDeliverySettings;
  });
export const getAgencyHostWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((hostname: string) => hostname.trim().toLowerCase().replace(/\.$/, ""))
  .handler(async ({ data: hostname }) => {
    const lookup = agencyHostLookup(hostname);
    if (!lookup) return null;
    const client = await db();
    let query = client.from("agency_domains").select("workspace_uuid");
    query = lookup.subdomain
      ? query.eq("subdomain", lookup.subdomain)
      : query.eq("custom_domain", lookup.customDomain).eq("verification_status", "verified");
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error("AGENCY_DOMAIN_LOOKUP_FAILED");
    return { workspaceId: data?.workspace_uuid ? String(data.workspace_uuid) : null };
  });
export const saveAgencyDeliverySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (x: {
      subdomain: string;
      customDomain: string;
      fromName: string;
      fromEmail: string;
      replyTo: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUsername?: string;
      smtpPassword?: string;
      turnstileConfigured?: boolean;
    }) => x,
  )
  .handler(async ({ data, context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const { data: r, error } = await client.rpc("save_agency_delivery_settings", {
      p_actor: context.userId,
      p_workspace: id,
      p_domain: { subdomain: data.subdomain, customDomain: data.customDomain },
      p_mail: { fromName: data.fromName, fromEmail: data.fromEmail, replyTo: data.replyTo },
    });
    if (error)
      throw new Error(error.code === "23505" ? "DOMAIN_ALREADY_USED" : "DELIVERY_SETTINGS_FAILED");
    const normalizedCustomDomain = data.customDomain.trim().toLowerCase().replace(/\.$/, "");
    const turnstile = await client
      .from("agency_domains")
      .update({
        turnstile_hostname_confirmed: normalizedCustomDomain
          ? Boolean(data.turnstileConfigured)
          : false,
        turnstile_hostname_confirmed_at:
          normalizedCustomDomain && data.turnstileConfigured ? new Date().toISOString() : null,
      })
      .eq("workspace_uuid", id);
    if (turnstile.error) throw new Error("TURNSTILE_STATUS_SAVE_FAILED");
    const smtpHost = data.smtpHost?.trim().toLowerCase() ?? "";
    const smtpUsername = data.smtpUsername?.trim() ?? "";
    const smtpPassword = data.smtpPassword?.trim() ?? "";
    if (smtpHost || smtpUsername || smtpPassword) {
      if (
        !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(smtpHost) ||
        /^(?:localhost|.*\.local)$/i.test(smtpHost)
      )
        throw new Error("INVALID_SMTP_HOST");
      const port = Math.round(Number(data.smtpPort ?? 587));
      if (port < 1 || port > 65535 || !smtpUsername) throw new Error("INVALID_SMTP_SETTINGS");
      const update: Record<string, unknown> = {
        smtp_host: smtpHost,
        smtp_port: port,
        smtp_secure: Boolean(data.smtpSecure),
        smtp_username: smtpUsername,
        smtp_secret_ref: `agency/${id}/smtp`,
        smtp_test_status: null,
        smtp_tested_at: null,
        smtp_last_error_code: null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      };
      if (smtpPassword) {
        const { encryptSecret } = await import("@/lib/secret-crypto.server");
        update.smtp_password_ciphertext = encryptSecret(smtpPassword);
      } else {
        const current = await client
          .from("agency_mail_settings")
          .select("smtp_password_ciphertext")
          .eq("workspace_uuid", id)
          .single();
        if (!current.data?.smtp_password_ciphertext) throw new Error("SMTP_PASSWORD_REQUIRED");
      }
      const saved = await client
        .from("agency_mail_settings")
        .update(update)
        .eq("workspace_uuid", id);
      if (saved.error) throw new Error("SMTP_SETTINGS_SAVE_FAILED");
    }
    return r;
  });

export const testAgencySmtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const { data } = await client
      .from("agency_mail_settings")
      .select(
        "from_name,from_email,reply_to,smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password_ciphertext",
      )
      .eq("workspace_uuid", id)
      .single();
    if (!data?.smtp_host || !data.smtp_username || !data.smtp_password_ciphertext)
      throw new Error("SMTP_NOT_CONFIGURED");
    let status: "ok" | "failed" = "failed",
      errorCode: string | null = null;
    try {
      const [{ decryptSecret }, nodemailer, { publicSmtpConnection }] = await Promise.all([
        import("@/lib/secret-crypto.server"),
        import("nodemailer"),
        import("../../worker/public-network.mjs"),
      ]);
      const transport = nodemailer.default.createTransport({
        ...await publicSmtpConnection(data.smtp_host),
        port: Number(data.smtp_port),
        secure: Boolean(data.smtp_secure),
        requireTLS: !data.smtp_secure,
        auth: { user: data.smtp_username, pass: decryptSecret(data.smtp_password_ciphertext) },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      await transport.verify();
      const account = await client.auth.admin.getUserById(context.userId);
      const recipient = account.data?.user?.email;
      if (!recipient)
        throw Object.assign(new Error("SMTP_TEST_RECIPIENT_MISSING"), {
          code: "SMTP_TEST_RECIPIENT_MISSING",
        });
      await transport.sendMail({
        from: { name: data.from_name, address: data.from_email },
        replyTo: data.reply_to || undefined,
        to: recipient,
        subject: "Agency SMTP test / SMTP-test",
        text: "Your Agency SMTP configuration works. / Je Agency-SMTP-configuratie werkt.",
        html: '<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Agency SMTP test</h1><p>Your Agency SMTP configuration works.</p><p>Je Agency-SMTP-configuratie werkt.</p></div>',
      });
      status = "ok";
    } catch (error) {
      errorCode = String((error as { code?: string })?.code ?? "SMTP_VERIFY_FAILED").slice(0, 80);
    }
    await client
      .from("agency_mail_settings")
      .update({
        smtp_test_status: status,
        smtp_tested_at: new Date().toISOString(),
        smtp_last_error_code: errorCode,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_uuid", id);
    if (status !== "ok") throw new Error(errorCode ?? "SMTP_VERIFY_FAILED");
    return { ok: true };
  });
export const verifyAgencyDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const { data: domain } = await client
      .from("agency_domains")
      .select("custom_domain,verification_token")
      .eq("workspace_uuid", id)
      .single();
    if (!domain?.custom_domain) throw new Error("CUSTOM_DOMAIN_REQUIRED");
    const { resolve4, resolveCname, resolveTxt } = await import("node:dns/promises");
    let cname: string[] = [],
      txt: string[][] = [];
    const [cnameResult, txtResult, domainIpResult, platformIpResult] = await Promise.allSettled([
      resolveCname(domain.custom_domain),
      resolveTxt(`_globetrotr.${domain.custom_domain}`),
      resolve4(domain.custom_domain),
      resolve4("portal.globetrotr.nl"),
    ]);
    if (cnameResult.status === "fulfilled") cname = cnameResult.value;
    if (txtResult.status === "fulfilled") txt = txtResult.value;
    const cnameOk =
      cname.some((value) =>
        ["globetrotr.nl", "dashboard.globetrotr.nl", "portal.globetrotr.nl"].includes(
          value.replace(/\.$/, "").toLowerCase(),
        ),
      ) ||
      (domainIpResult.status === "fulfilled" &&
        platformIpResult.status === "fulfilled" &&
        domainIpResult.value.some((ip) => platformIpResult.value.includes(ip)));
    const txtOk = txt.some(
      (parts) => parts.join("") === `globetrotr-verification=${domain.verification_token}`,
    );
    const verified = cnameOk && txtOk;
    const { error: updateError } = await client
      .from("agency_domains")
      .update({
        verification_status: verified ? "verified" : "failed",
        verified_at: verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_uuid", id);
    if (updateError) throw new Error("DOMAIN_VERIFICATION_SAVE_FAILED");
    return { verified, cnameOk, txtOk };
  });
