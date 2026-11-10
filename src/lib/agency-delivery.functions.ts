import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agencyHostLookup } from "@/lib/agency-domain";
import { agencyCloudflareTarget, agencyDnsEvidence } from "../../worker/agency-domain.mjs";
import { agencySmtpDisplayPort, prepareAgencyDeliveryMail } from "./agency-delivery-mail";
export type AgencyDeliverySettings = {
  workspaceId: string;
  subdomain: string;
  customDomain: string;
  domainStatus: "unconfigured" | "pending" | "verified" | "failed";
  verificationToken: string;
  turnstileConfigured: boolean;
  domainCnameTarget: string;
  cloudflareEnabled: boolean;
  domainAutomationEnabled: boolean;
  dnsKind: "cname" | "alias";
  provisioningState: string;
  provisioningError: string;
  providerDnsRecords: { type: "TXT" | "CNAME"; name: string; value: string }[];
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
/** Only this authenticated Agency owner's saved hosts; never the global allowlist or token. */
export const getAgencyLoginStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db();
    const id = await workspace(client, context.userId);
    const domain = await client.from("agency_domains")
      .select("subdomain,custom_domain,verification_status").eq("workspace_uuid", id).maybeSingle();
    if (domain.error) throw new Error("AGENCY_DOMAIN_LOOKUP_FAILED");
    const sync = await client.from("agency_auth_redirect_sync")
      .select("checked_hosts,checked_at,error_code").eq("id", true).maybeSingle();
    const { agencyLoginState } = await import("./agency-login-status");
    const d = domain.data;
    return [
      ...(d?.subdomain ? [{ hostname: `${d.subdomain}.globetrotr.nl`, verified: true }] : []),
      ...(d?.custom_domain ? [{ hostname: d.custom_domain, verified: d.verification_status === "verified" }] : []),
    ].map(({ hostname, verified }) => ({ hostname,
      state: sync.error ? "unknown" as const : agencyLoginState(hostname, verified, sync.data) }));
  });
export const getAgencyDeliverySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const { cloudflareSaasConfig } = await import("../../worker/cloudflare-saas.mjs");
    const cloudflare = cloudflareSaasConfig(process.env);
    const domainAutomationEnabled = cloudflare.enabled && process.env.CLOUDFLARE_DOMAIN_AUTOMATION_ENABLED === "true";
    const [{ data: d }, { data: m }, { data: s }] = await Promise.all([
      client
        .from("agency_domains")
        .select("subdomain,custom_domain,verification_status,verification_token,turnstile_hostname_confirmed,dns_kind")
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
        .select("system_name,sender_name,contact_email")
        .eq("workspace_uuid", id)
        .maybeSingle(),
    ]);
    let provision: any = null;
    if (domainAutomationEnabled && d?.custom_domain) {
      const result = await client.from("agency_domain_provisioning")
        .select("hostname,state,error_code,dns_records")
        .eq("workspace_uuid", id).eq("hostname", d.custom_domain).eq("desired", true).maybeSingle();
      if (result.error) throw new Error("DOMAIN_PROVISIONING_LOOKUP_FAILED");
      provision = result.data;
    }
    return {
      workspaceId: id,
      subdomain: d?.subdomain ?? "",
      customDomain: d?.custom_domain ?? "",
      domainStatus: d?.verification_status ?? "unconfigured",
      verificationToken: d?.verification_token ?? "",
      turnstileConfigured: Boolean(d?.turnstile_hostname_confirmed),
      domainCnameTarget: cloudflare.enabled ? agencyCloudflareTarget : "portal.globetrotr.nl",
      cloudflareEnabled: cloudflare.enabled,
      domainAutomationEnabled,
      dnsKind: d?.dns_kind === "alias" ? "alias" : "cname",
      provisioningState: provision?.state ?? "queued",
      provisioningError: provision?.error_code ?? "",
      providerDnsRecords: Array.isArray(provision?.dns_records) ? provision.dns_records : [],
      fromName: m?.from_name || s?.sender_name || s?.system_name || "",
      fromEmail: m?.from_email || s?.contact_email || "",
      replyTo: m?.reply_to ?? s?.contact_email ?? "",
      mailStatus: m?.verification_status ?? "unconfigured",
      smtpConfigured: Boolean(m?.smtp_secret_ref && m?.smtp_host && m?.smtp_password_ciphertext),
      smtpHost: m?.smtp_host ?? "",
      smtpPort: agencySmtpDisplayPort(m?.smtp_port),
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
      dnsKind?: "cname" | "alias";
    }) => x,
  )
  .handler(async ({ data, context }) => {
    const client = await db(),
      id = await workspace(client, context.userId);
    const subdomain = data.subdomain.trim().toLowerCase();
    const customDomain = data.customDomain.trim().toLowerCase().replace(/\.$/, "");
    if (subdomain && agencyHostLookup(`${subdomain}.globetrotr.nl`)?.subdomain !== subdomain)
      throw new Error("INVALID_AGENCY_SUBDOMAIN");
    if (customDomain && agencyHostLookup(customDomain)?.customDomain !== customDomain)
      throw new Error("INVALID_CUSTOM_DOMAIN");
    const automated = process.env.CLOUDFLARE_DOMAIN_AUTOMATION_ENABLED === "true";
    if (data.dnsKind && !["cname", "alias"].includes(data.dnsKind)) throw new Error("INVALID_DOMAIN_DNS_KIND");
    if (data.dnsKind === "alias" && !automated) throw new Error("APEX_AUTOMATION_REQUIRED");
    // Validate mail and SMTP before persisting domain changes.
    const [organisation, existingSmtp] = await Promise.all([
      client.from("agency_settings").select("system_name,sender_name,contact_email").eq("workspace_uuid", id).maybeSingle(),
      client.from("agency_mail_settings").select("smtp_password_ciphertext").eq("workspace_uuid", id).maybeSingle(),
    ]);
    if (organisation.error || existingSmtp.error) throw new Error("DELIVERY_SETTINGS_LOOKUP_FAILED");
    const prepared = prepareAgencyDeliveryMail(data, organisation.data ?? {}, Boolean(existingSmtp.data?.smtp_password_ciphertext));
    const { data: r, error } = await client.rpc(automated ? "save_agency_delivery_settings_automated" : "save_agency_delivery_settings", {
      p_actor: context.userId,
      p_workspace: id,
      p_domain: { subdomain, customDomain, dnsKind: data.dnsKind ?? "cname" },
      p_mail: prepared.mail,
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
    const update: Record<string, unknown> = {
      smtp_host: prepared.smtp?.host ?? null,
      smtp_port: prepared.smtp?.port ?? 587,
      smtp_secure: prepared.smtp?.secure ?? false,
      smtp_username: prepared.smtp?.username ?? null,
      smtp_secret_ref: prepared.smtp ? `agency/${id}/smtp` : null,
      smtp_test_status: null, smtp_tested_at: null, smtp_last_error_code: null,
      updated_by: context.userId, updated_at: new Date().toISOString(),
    };
    if (prepared.smtp?.password) {
      const { encryptSecret } = await import("@/lib/secret-crypto.server");
      update.smtp_password_ciphertext = encryptSecret(prepared.smtp.password);
    } else if (!prepared.smtp) {
      update.smtp_password_ciphertext = null;
    }
    const saved = await client.from("agency_mail_settings").update(update).eq("workspace_uuid", id);
    if (saved.error) throw new Error("SMTP_SETTINGS_SAVE_FAILED");
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
    if (process.env.CLOUDFLARE_DOMAIN_AUTOMATION_ENABLED === "true") {
      const request = await client.rpc("request_agency_domain_verification", {
        p_actor: context.userId, p_workspace: id,
      });
      if (request.error) throw new Error("DOMAIN_VERIFICATION_REQUEST_FAILED");
      return { verified: false, cnameOk: false, txtOk: false, cloudflareEnabled: true,
        cloudflareState: "checking" };
    }
    const { data: domain, error: domainError } = await client
      .from("agency_domains")
      .select("custom_domain,verification_token")
      .eq("workspace_uuid", id)
      .single();
    if (domainError) throw new Error("AGENCY_DOMAIN_LOOKUP_FAILED");
    if (!domain?.custom_domain) throw new Error("CUSTOM_DOMAIN_REQUIRED");
    if (agencyHostLookup(domain.custom_domain)?.customDomain !== domain.custom_domain)
      throw new Error("INVALID_CUSTOM_DOMAIN");
    const { cloudflareSaasConfig, cloudflareHostnameStatus } = await import("../../worker/cloudflare-saas.mjs");
    const cloudflare = cloudflareSaasConfig(process.env);
    const { resolveCname, resolveTxt } = await import("node:dns/promises");
    let cname: string[] = [],
      txt: string[][] = [];
    const [cnameResult, txtResult] = await Promise.allSettled([
      resolveCname(domain.custom_domain),
      resolveTxt(`_globetrotr.${domain.custom_domain}`),
    ]);
    for (const result of [cnameResult, txtResult]) {
      if (result.status === "rejected" && !["ENODATA", "ENOTFOUND"].includes(result.reason?.code))
        throw new Error("DOMAIN_DNS_CHECK_UNAVAILABLE");
    }
    if (cnameResult.status === "fulfilled") cname = cnameResult.value;
    if (txtResult.status === "fulfilled") txt = txtResult.value;
    const { cnameOk, txtOk } = agencyDnsEvidence(cname, txt, domain.verification_token, cloudflare.enabled);
    // Do not spend API calls before the customer's unique DNS proof is present.
    const provider = cloudflare.enabled && cnameOk && txtOk
      ? await cloudflareHostnameStatus(cloudflare, domain.custom_domain)
      : { ready: !cloudflare.enabled, state: cloudflare.enabled ? "dns_pending" : "disabled" };
    const verified = cnameOk && txtOk && provider.ready;
    const { data: updated, error: updateError } = await client
      .from("agency_domains")
      .update({
        verification_status: verified ? "verified" : "pending",
        verified_at: verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_uuid", id)
      .eq("custom_domain", domain.custom_domain)
      .eq("verification_token", domain.verification_token)
      .select("workspace_uuid")
      .maybeSingle();
    if (updateError) throw new Error("DOMAIN_VERIFICATION_SAVE_FAILED");
    if (!updated) throw new Error("DOMAIN_CHANGED_DURING_VERIFICATION");
    return { verified, cnameOk, txtOk, cloudflareEnabled: cloudflare.enabled, cloudflareState: provider.state };
  });

/** Read-only DNS evidence for this owner's saved domain, never client-supplied hostnames. */
export const checkAgencyDomainDns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db();
    const id = await workspace(client, context.userId);
    const { data: domain, error } = await client.from("agency_domains")
      .select("custom_domain,verification_token,dns_kind")
      .eq("workspace_uuid", id).single();
    if (error) throw new Error("AGENCY_DOMAIN_LOOKUP_FAILED");
    if (!domain?.custom_domain || agencyHostLookup(domain.custom_domain)?.customDomain !== domain.custom_domain)
      throw new Error("INVALID_CUSTOM_DOMAIN");
    const { cloudflareSaasConfig } = await import("../../worker/cloudflare-saas.mjs");
    const cloudflare = cloudflareSaasConfig(process.env);
    let providerDnsRecords: { type: "TXT" | "CNAME"; name: string; value: string }[] = [];
    if (cloudflare.enabled && process.env.CLOUDFLARE_DOMAIN_AUTOMATION_ENABLED === "true") {
      const provision = await client.from("agency_domain_provisioning").select("dns_records")
        .eq("workspace_uuid", id).eq("hostname", domain.custom_domain).eq("desired", true).maybeSingle();
      if (provision.error) throw new Error("DOMAIN_PROVISIONING_LOOKUP_FAILED");
      providerDnsRecords = Array.isArray(provision.data?.dns_records) ? provision.data.dns_records : [];
    }
    const { agencyDnsRecords, checkAgencyDnsRecords } = await import("./agency-dns");
    const records = agencyDnsRecords({ customDomain: domain.custom_domain,
      verificationToken: domain.verification_token, dnsKind: domain.dns_kind,
      domainCnameTarget: cloudflare.enabled ? agencyCloudflareTarget : "portal.globetrotr.nl", providerDnsRecords });
    if (records.length > 20) throw new Error("DOMAIN_DNS_CHECK_UNAVAILABLE");
    const { Resolver } = await import("node:dns/promises");
    const resolver = new Resolver({ timeout: 2000, tries: 1 });
    try {
      return { hostname: domain.custom_domain, verificationToken: domain.verification_token,
        dnsKind: domain.dns_kind === "alias" ? "alias" : "cname", checkedAt: new Date().toISOString(),
        records: await checkAgencyDnsRecords(records, {
          cname: name => resolver.resolveCname(name), txt: name => resolver.resolveTxt(name),
        }) };
    } finally { resolver.cancel(); }
  });
