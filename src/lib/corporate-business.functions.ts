import { mailLocale } from "./mail-locale.ts";
import { createServerFn } from "@tanstack/react-start";
import { composedMailHtml, corporateSignatureHtml, corporateSignatureText } from "@/lib/safe-mail-html";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAIL_ATTACHMENT_TYPES, validMailAttachments } from "@/lib/mail-attachments";
import { classifyPaddleDiagnosis } from "@/lib/paddle-diagnosis";
import { corporateMailboxAccess } from "./corporate-mail-access";
import { validateStaffRemoval } from "./staff-removal";

async function dbFor(userId: string, capability?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: user }, { data: admin }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from("platform_admins")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (
    user.user?.app_metadata?.corporate_admin !== true ||
    !admin ||
    (capability && admin.role !== "owner" && admin.permissions?.[capability] !== true)
  )
    throw new Error("FORBIDDEN");
  return db;
}
async function log(
  db: any,
  actor: string,
  action: string,
  target: string | null,
  details: Record<string, unknown> = {},
) {
  await db.from("platform_admin_audit_log").insert({
    actor_user_id: actor,
    action,
    target_type: "business_operations",
    target_id: target,
    result: "success",
    details,
  });
}
const addressPattern = /^[a-z0-9][a-z0-9._-]*@globetrotr\.nl$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
function defaultSignature(displayName: string) {
  return `${displayName.trim()}\nGlobeTrotr\nPlan every trip. Track every euro.\nPlan je reis / Plan your trip: https://globetrotr.nl\nContact: https://globetrotr.nl/contact`;
}
async function staffDb(userId: string) {
  return dbFor(userId, "mail");
}
async function mailboxPermission(db: any, userId: string, mailboxId: string) {
  const { data: mailbox } = await db
    .from("corporate_mailboxes")
    .select("id,address,display_name,owner_user_id,signature_text,sync_status,active")
    .eq("id", mailboxId)
    .eq("active", true)
    .maybeSingle();
  if (!mailbox) throw new Error("MAILBOX_NOT_FOUND");
  if (mailbox.owner_user_id === userId) return { mailbox, permission: "manage" };
  const { data: member } = await db
    .from("corporate_mailbox_members")
    .select("permission")
    .eq("mailbox_id", mailboxId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("FORBIDDEN");
  return { mailbox, permission: member.permission as "read" | "reply" | "manage" };
}

export const getCorporateBusinessData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await dbFor(context.userId, "mail");
    const [m, mm, p, a, deletions] = await Promise.all([
      db
        .from("corporate_mailboxes")
        .select(
          "id,address,display_name,mailbox_type,owner_user_id,signature_text,sync_status,last_synced_at,last_sync_attempt_at,last_sync_error_code,sync_requested_at,active,imap_host,imap_port,imap_secure,imap_username,credentials_updated_at,hosting_mode,provisioning_status,provisioning_requested_at,provisioned_at,provisioning_error_code,mail_server_account_id",
        )
        .order("address"),
      db.from("corporate_mailbox_members").select("mailbox_id,user_id,permission"),
      db.from("profiles").select("id,display_name,email"),
      db.from("platform_admins").select("user_id,role,active"),
      db.from("corporate_mailbox_deletions").select("mailbox_id,status,error_code"),
    ]);
    if (m.error || mm.error || p.error || a.error || deletions.error) throw new Error("BUSINESS_DATA_UNAVAILABLE");
    const profiles = new Map((p.data ?? []).map((row: any) => [row.id, row]));
    return {
      canDeleteMailbox: (a.data ?? []).some((row: any) => row.user_id === context.userId && row.active && row.role === "owner"),
      mailboxes: (m.data ?? []).map((mailbox: any) => ({ ...mailbox,
        deletion: (deletions.data ?? []).find((job: any) => job.mailbox_id === mailbox.id) ?? null })),
      mailboxMembers: mm.data ?? [],
      people: (a.data ?? [])
        .filter((x: any) => x.active)
        .map((x: any) => {
          const profile: any = profiles.get(x.user_id);
          return {
            id: x.user_id,
            name: profile?.display_name || profile?.email || x.user_id,
            email: profile?.email,
            role: x.role,
          };
        }),
    };
  });

export const deleteCorporateMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; address: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || typeof data.address !== "string" || typeof data.reason !== "string")
      throw new Error("MAILBOX_DELETE_CONFIRMATION_INVALID");
    const db = await dbFor(context.userId, "mail");
    const { error } = await db.rpc("request_corporate_mailbox_deletion", {
      p_actor: context.userId, p_mailbox: data.mailboxId,
      p_address: data.address.trim(), p_reason: data.reason.trim(),
    });
    if (error) {
      const allowed = ["FORBIDDEN", "MAILBOX_DELETE_CONFIRMATION_INVALID", "MAILBOX_DELETION_PENDING",
        "MAILBOX_NOT_PROVISIONED", "MAILBOX_PROTECTED", "MAILBOX_BUSY", "MAILBOX_RETENTION_BLOCKED", "MAILBOX_STORAGE_SHARED"];
      throw new Error(allowed.includes(error.message) ? error.message : "MAILBOX_DELETE_FAILED");
    }
    return { ok: true };
  });

export const saveCorporateMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      address: string;
      displayName: string;
      mailboxType: "personal" | "shared" | "automated";
      hostingMode?: "external" | "self_hosted";
      ownerUserId?: string;
      signatureText: string;
      inboundSecretRef: string;
      outboundSecretRef: string;
      active: boolean;
      imapHost?: string;
      imapPort?: number;
      imapSecure?: boolean;
      imapUsername?: string;
      imapPassword?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId, "mail");
    const address = data.address.trim().toLowerCase();
    if (
      !addressPattern.test(address) ||
      data.displayName.trim().length < 2 ||
      data.signatureText.length > 2000
    )
      throw new Error("INVALID_MAILBOX");
    if (data.mailboxType === "personal" && !data.ownerUserId)
      throw new Error("MAILBOX_OWNER_REQUIRED");
    const hostingMode=data.hostingMode==="self_hosted"?"self_hosted":"external";
    let suppliedPassword=data.imapPassword?.trim()||"";
    if(hostingMode==="self_hosted"&&!suppliedPassword&&!data.id){
      if(data.mailboxType!=="automated")throw new Error("MAILBOX_PASSWORD_REQUIRED");
      const {randomBytes}=await import("node:crypto");suppliedPassword=randomBytes(32).toString("base64url");
    }
    const row: Record<string, unknown> = {
      address,
      display_name: data.displayName.trim(),
      mailbox_type: data.mailboxType,
      owner_user_id: data.mailboxType === "personal" ? data.ownerUserId : null,
      signature_text: data.signatureText.trim() || defaultSignature(data.displayName),
      inbound_secret_ref: data.inboundSecretRef.trim() || null,
      outbound_secret_ref: data.outboundSecretRef.trim() || null,
      active: data.active,
      hosting_mode: hostingMode,
      updated_at: new Date().toISOString(),
      imap_host: hostingMode==="self_hosted"?"mail.globetrotr.nl":data.imapHost?.trim() || null,
      imap_port: Math.min(65535, Math.max(1, Number(data.imapPort) || 993)),
      imap_secure: data.imapSecure !== false,
      imap_username: hostingMode==="self_hosted"?address:data.imapUsername?.trim() || null,
    };
    if (suppliedPassword) {
      const { encryptSecret } = await import("@/lib/secret-crypto.server");
      row.imap_password_ciphertext = encryptSecret(suppliedPassword);
      row.credentials_updated_at = new Date().toISOString();
    }
    if(hostingMode==="self_hosted"){
      row.provisioning_status="pending";row.provisioning_requested_at=new Date().toISOString();row.provisioning_error_code=null;
    }else{row.provisioning_status="external";row.provisioning_requested_at=null;row.provisioning_error_code=null}
    const q = data.id
      ? db.from("corporate_mailboxes").update(row).eq("id", data.id)
      : db.from("corporate_mailboxes").insert(row);
    const { data: saved, error } = await q.select("id").single();
    if (error) throw new Error("MAILBOX_SAVE_FAILED");
    await log(db, context.userId, "platform.mailbox.save", saved.id, {
      address,
      mailboxType: data.mailboxType,
      hostingMode,
    });
    return { ok: true, id: saved.id };
  });

export const requestCorporateMailboxSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId)) throw new Error("INVALID_MAILBOX");
    const db = await dbFor(context.userId, "mail");
    const { data: mailbox, error } = await db
      .from("corporate_mailboxes")
      .update({ sync_requested_at: new Date().toISOString() })
      .eq("id", data.mailboxId)
      .eq("active", true)
      .is("sync_requested_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error("MAILBOX_SYNC_REQUEST_FAILED");
    if (!mailbox) throw new Error("MAILBOX_SYNC_ALREADY_REQUESTED_OR_INACTIVE");
    await log(db, context.userId, "platform.mailbox.sync.request", data.mailboxId);
    return { ok: true };
  });

export const retryCorporateMailboxProvisioning=createServerFn({method:"POST"})
 .middleware([requireSupabaseAuth]).validator((input:{mailboxId:string})=>input)
 .handler(async({data,context})=>{
  if(!uuid.test(data.mailboxId))throw new Error("INVALID_MAILBOX");const db=await dbFor(context.userId,"mail");
  const {data:mailbox,error}=await db.from("corporate_mailboxes").update({provisioning_status:"pending",provisioning_requested_at:new Date().toISOString(),provisioning_error_code:null,updated_at:new Date().toISOString()}).eq("id",data.mailboxId).eq("hosting_mode","self_hosted").eq("provisioning_status","error").not("imap_password_ciphertext","is",null).select("id").maybeSingle();
  if(error||!mailbox)throw new Error("MAILBOX_PROVISIONING_RETRY_FAILED");await log(db,context.userId,"platform.mailbox.provisioning.retry",data.mailboxId);return{ok:true};
 });

export const setCorporateMailboxMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      mailboxId: string;
      userId: string;
      permission: "none" | "read" | "reply" | "manage";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId, "mail");
    const { error } =
      data.permission === "none"
        ? await db
            .from("corporate_mailbox_members")
            .delete()
            .eq("mailbox_id", data.mailboxId)
            .eq("user_id", data.userId)
        : await db
            .from("corporate_mailbox_members")
            .upsert(
              { mailbox_id: data.mailboxId, user_id: data.userId, permission: data.permission },
              { onConflict: "mailbox_id,user_id" },
            );
    if (error) throw new Error("MAILBOX_PERMISSION_FAILED");
    await log(db, context.userId, "platform.mailbox.permission", data.mailboxId, {
      userId: data.userId,
      permission: data.permission,
    });
    return { ok: true };
  });

export const getEmailDeliveryOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await dbFor(context.userId, "mail");
    const [serviceResult, corporateResult] = await Promise.all([
      db
        .from("email_outbox")
        .select("id,recipient_email,template_key,status,attempts,created_at,sent_at,last_error_code,invitation_type,invitation_id")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("corporate_mail_send_queue")
        .select("id,mailbox_id,recipient_addresses,subject,status,attempts,created_at,sent_at,last_error_code")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (serviceResult.error || corporateResult.error) throw new Error("DELIVERY_OVERVIEW_UNAVAILABLE");
    const serviceMessages = (serviceResult.data ?? []).map((message: any) => ({
      ...message,
      source: "service" as const,
      mailbox_id: null,
      subject: null,
    }));
    const corporateMessages = (corporateResult.data ?? []).map((message: any) => ({
      id: message.id,
      recipient_email: (message.recipient_addresses ?? []).join(", "),
      template_key: "corporate_mail",
      status: message.status,
      attempts: message.attempts,
      created_at: message.created_at,
      sent_at: message.sent_at,
      last_error_code: message.last_error_code,
      invitation_type: null,
      invitation_id: null,
      source: "corporate" as const,
      mailbox_id: message.mailbox_id,
      subject: message.subject,
    }));
    const messages = [...serviceMessages, ...corporateMessages]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 100);
    return {
      messages,
      counts: Object.fromEntries(
        ["held", "pending", "processing", "sent", "failed", "cancelled"].map((status) => [
          status,
          messages.filter((item: any) => item.status === status).length,
        ]),
      ),
    };
  });

export const retryEmailDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; source?: "service" | "corporate" }) => input)
  .handler(async ({ data, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) throw new Error("INVALID_DELIVERY");
    const db = await dbFor(context.userId, "mail");
    const { data: config } = await db
      .from("email_delivery_config")
      .select("mode")
      .eq("id", true)
      .single();
    const table = data.source === "corporate" ? "corporate_mail_send_queue" : "email_outbox";
    const { data: message, error } = await db
      .from(table)
      .update({
        status: config?.mode === "live" ? "pending" : "held",
        attempts: 0,
        available_at: new Date().toISOString(),
        claimed_at: null,
        last_error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (error || !message) throw new Error("DELIVERY_NOT_RETRYABLE");
    await log(db, context.userId, "platform.mail.delivery.retry", data.id, {
      source: data.source === "corporate" ? "corporate" : "service",
    });
    return { ok: true };
  });

export const getEmailDeliveryMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await dbFor(context.userId, "mail");
    const { data, error } = await db
      .from("email_delivery_config")
      .select("mode,updated_at,updated_by")
      .eq("id", true)
      .single();
    if (error) throw new Error("DELIVERY_MODE_UNAVAILABLE");
    return data as { mode: "test" | "live"; updated_at: string; updated_by: string | null };
  });

export const setEmailDeliveryMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mode: "test" | "live"; releaseHeld: boolean; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (
      !["test", "live"].includes(data.mode) ||
      data.reason.trim().length < 10 ||
      data.reason.length > 300
    )
      throw new Error("INVALID_DELIVERY_MODE");
    const db = await dbFor(context.userId, "mail");
    const { data: result, error } = await db.rpc("set_email_delivery_mode", {
      p_mode: data.mode,
      p_release_held: data.releaseHeld,
      p_actor: context.userId,
    });
    if (error) throw new Error("DELIVERY_MODE_UPDATE_FAILED");
    const released = Number(result?.changed ?? 0);
    await log(db, context.userId, "platform.mail.delivery.mode", null, {
      mode: data.mode,
      releaseHeld: data.releaseHeld,
      released,
      reason: data.reason.trim(),
    });
    return { ok: true, released };
  });

export const getMyCorporateMail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { mailboxId?: string; archiveLimit?: number }) => input ?? {})
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    const [owned, members] = await Promise.all([
      db
        .from("corporate_mailboxes")
        .select("id,address,display_name,owner_user_id,signature_text,sync_status,active")
        .eq("owner_user_id", context.userId)
        .eq("active", true),
      db
        .from("corporate_mailbox_members")
        .select(
          "permission,corporate_mailboxes(id,address,display_name,owner_user_id,signature_text,sync_status,active)",
        )
        .eq("user_id", context.userId),
    ]);
    if (owned.error || members.error) throw new Error("MAIL_ACCESS_UNAVAILABLE");
    const unique = corporateMailboxAccess(owned.data ?? [], members.data ?? []) as any[];
    const selectedId =
      data.mailboxId && unique.some((m) => m.id === data.mailboxId)
        ? data.mailboxId
        : unique[0]?.id;
    if (!selectedId)
      return {
        mailboxes: [], messages: [], outbox: [], drafts: [], selected: null, archiveHasMore: false,
      };
    const selected = unique.find((m) => m.id === selectedId);
    const archiveLimit = Math.min(250, Math.max(10, Math.floor(data.archiveLimit ?? 10)));
    const messageFields = "id,provider_message_id,thread_key,direction,sender_address,recipient_addresses,subject,preview_text,body_text,body_html,received_at,read_at,mail_folder,archived_at,retention_reviewed,retention_hold,retention_hold_reason,retention_review_at";
    const [messages, archivedMessages, outbox, drafts, junkMessages] = await Promise.all([
      db
        .from("corporate_mail_messages")
        .select(messageFields)
        .eq("mailbox_id", selectedId)
        .eq("mail_folder", "inbox")
        .is("archived_at", null)
        .order("received_at", { ascending: false })
        .limit(100),
      db
        .from("corporate_mail_messages")
        .select(messageFields)
        .eq("mailbox_id", selectedId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(archiveLimit + 1),
      db
        .from("corporate_mail_send_queue")
        .select(
          "id,recipient_addresses,cc_addresses,subject,body_text,body_html,status,attempts,sent_at,last_error_code,created_at",
        )
        .eq("mailbox_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("corporate_mail_drafts")
        .select(
          "id,recipient_addresses,cc_addresses,subject,body_text,body_html,in_reply_to_message_id,updated_at",
        )
        .eq("mailbox_id", selectedId)
        .eq("created_by", context.userId)
        .order("updated_at", { ascending: false })
        .limit(50),
      db.from("corporate_mail_messages").select(messageFields)
        .eq("mailbox_id", selectedId).eq("mail_folder", "junk").is("archived_at", null)
        .order("received_at", { ascending: false }).limit(100),
    ]);
    if (messages.error || archivedMessages.error || outbox.error || drafts.error || junkMessages.error)
      throw new Error("MAIL_LOAD_FAILED");
    const archiveRows = (archivedMessages.data ?? []).slice(0, archiveLimit);
    const allMessages = [...(messages.data ?? []), ...(junkMessages.data ?? []), ...archiveRows];
    const messageIds = allMessages.map((row: any) => row.id);
    const queueIds = (outbox.data ?? []).map((row: any) => row.id);
    const filters = [
      messageIds.length ? `message_id.in.(${messageIds.join(",")})` : "",
      queueIds.length ? `send_queue_id.in.(${queueIds.join(",")})` : "",
    ].filter(Boolean);
    const { data: attachments, error: attachmentError } = filters.length
      ? await db
          .from("corporate_mail_attachments")
          .select("id,message_id,send_queue_id,file_name,content_type,size_bytes")
          .or(filters.join(","))
      : { data: [], error: null };
    if (attachmentError) throw new Error("MAIL_LOAD_FAILED");
    const forParent = (key: "message_id" | "send_queue_id", id: string) =>
      (attachments ?? []).filter((attachment: any) => attachment[key] === id);
    return {
      mailboxes: unique,
      messages: allMessages.map((row: any) => ({
        ...row,
        attachments: forParent("message_id", row.id),
      })),
      archiveHasMore: (archivedMessages.data?.length ?? 0) > archiveLimit,
      outbox: (outbox.data ?? []).map((row: any) => ({
        ...row,
        attachments: forParent("send_queue_id", row.id),
      })),
      drafts: drafts.data ?? [],
      selected,
    };
  });

export const prepareCorporateMailAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      mailboxId: string;
      files: { fileName: string; contentType: string; sizeBytes: number; sha256: string }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    await mailboxPermission(db, context.userId, data.mailboxId);
    const total = data.files.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0);
    if (
      !data.files.length ||
      data.files.length > 5 ||
      total > 20 * 1024 * 1024 ||
      !validMailAttachments(data.files)
    )
      throw new Error("INVALID_ATTACHMENTS");
    const prepared = [];
    for (const file of data.files) {
      const extension = file.fileName.includes(".")
        ? `.${file.fileName
            .split(".")
            .pop()!
            .replace(/[^a-z0-9]/gi, "")
            .slice(0, 10)}`
        : "";
      const storageKey = `${data.mailboxId}/${context.userId}/${crypto.randomUUID()}${extension}`;
      const { data: signed, error } = await db.storage
        .from("corporate-mail")
        .createSignedUploadUrl(storageKey);
      if (error || !signed?.token) throw new Error("ATTACHMENT_UPLOAD_PREPARE_FAILED");
      prepared.push({ ...file, storageKey, token: signed.token });
    }
    const { error: reservationError } = await db.from("corporate_mail_uploads").insert(
      prepared.map((file) => ({
        mailbox_id: data.mailboxId,
        created_by: context.userId,
        storage_key: file.storageKey,
        file_name: file.fileName,
        content_type: file.contentType,
        size_bytes: file.sizeBytes,
        sha256: file.sha256,
      })),
    );
    if (reservationError) throw new Error("ATTACHMENT_UPLOAD_PREPARE_FAILED");
    return prepared;
  });

export const getCorporateMailAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; attachmentId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || !uuid.test(data.attachmentId))
      throw new Error("INVALID_ATTACHMENT");
    const db = await staffDb(context.userId);
    await mailboxPermission(db, context.userId, data.mailboxId);
    const { data: attachment } = await db
      .from("corporate_mail_attachments")
      .select(
        "storage_key,file_name,corporate_mail_messages!left(mailbox_id),corporate_mail_send_queue!left(mailbox_id)",
      )
      .eq("id", data.attachmentId)
      .maybeSingle();
    const messageMailbox = (attachment as any)?.corporate_mail_messages?.mailbox_id;
    const queueMailbox = (attachment as any)?.corporate_mail_send_queue?.mailbox_id;
    if (!attachment || (messageMailbox !== data.mailboxId && queueMailbox !== data.mailboxId))
      throw new Error("ATTACHMENT_NOT_FOUND");
    const { data: signed, error } = await db.storage
      .from("corporate-mail")
      .createSignedUrl(attachment.storage_key, 60, { download: attachment.file_name });
    if (error || !signed?.signedUrl) throw new Error("ATTACHMENT_DOWNLOAD_FAILED");
    return { url: signed.signedUrl };
  });

export const getCorporateMailInlineImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; messageId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || !uuid.test(data.messageId)) throw new Error("INVALID_MAIL_MESSAGE");
    const db = await staffDb(context.userId);
    await mailboxPermission(db, context.userId, data.mailboxId);
    const { data: message } = await db.from("corporate_mail_messages")
      .select("id").eq("id", data.messageId).eq("mailbox_id", data.mailboxId).maybeSingle();
    if (!message) throw new Error("MAIL_MESSAGE_NOT_FOUND");
    const { data: attachments, error } = await db.from("corporate_mail_attachments")
      .select("content_id,storage_key,content_type")
      .eq("message_id", data.messageId)
      .not("content_id", "is", null)
      .like("content_type", "image/%")
      .limit(5);
    if (error) throw new Error("MAIL_IMAGES_UNAVAILABLE");
    const images = await Promise.all((attachments ?? []).map(async (attachment: any) => {
      const { data: signed, error: signError } = await db.storage.from("corporate-mail")
        .createSignedUrl(attachment.storage_key, 120);
      return !signError && signed?.signedUrl
        ? { contentId: attachment.content_id as string, url: signed.signedUrl as string }
        : null;
    }));
    return { images: images.filter((image): image is { contentId: string; url: string } => Boolean(image)) };
  });

export const queueCorporateMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      mailboxId: string;
      recipients: string[];
      cc: string[];
      subject: string;
      body: string;
      bodyHtml: string;
      draftId?: string;
      replyToId?: string;
      attachments?: {
        storageKey: string;
        fileName: string;
        contentType: string;
        sizeBytes: number;
        sha256: string;
      }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (!["reply", "manage"].includes(access.permission)) throw new Error("FORBIDDEN");
    const recipients = [
      ...new Set(data.recipients.map((v) => v.trim().toLowerCase()).filter(Boolean)),
    ];
    const cc = [...new Set(data.cc.map((v) => v.trim().toLowerCase()).filter(Boolean))];
    if (
      !recipients.length ||
      recipients.length > 25 ||
      cc.length > 25 ||
      ![...recipients, ...cc].every((v) => emailPattern.test(v)) ||
      !data.subject.trim() ||
      !data.body.trim() ||
      data.body.length > 50_000 ||
      data.bodyHtml.length > 100_000
    )
      throw new Error("INVALID_MESSAGE");
    const messageText = data.body.trim();
    const messageHtml = composedMailHtml(data.bodyHtml, data.body);
    if (!messageHtml) throw new Error("INVALID_MESSAGE");
    const signatureInput = {
      signatureText: access.mailbox.signature_text || "",
      displayName: access.mailbox.display_name,
      address: access.mailbox.address,
    };
    const body = `${messageText}\n\n${corporateSignatureText(signatureInput)}`;
    const attachments = data.attachments ?? [];
    const expectedPrefix = `${data.mailboxId}/${context.userId}/`;
    if (
      attachments.length > 5 ||
      attachments.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0) > 20 * 1024 * 1024 ||
      attachments.some(
        (file) =>
          !file.storageKey.startsWith(expectedPrefix) ||
          file.storageKey.includes("..") ||
          !MAIL_ATTACHMENT_TYPES.has(file.contentType) ||
          file.fileName.length < 1 ||
          file.fileName.length > 255 ||
          file.sizeBytes < 1 ||
          file.sizeBytes > 10 * 1024 * 1024 ||
          !sha256Pattern.test(file.sha256),
      )
    )
      throw new Error("INVALID_ATTACHMENTS");
    if (attachments.length) {
      const { data: reservations, error: reservationError } = await db
        .from("corporate_mail_uploads")
        .select("storage_key,file_name,content_type,size_bytes,sha256")
        .eq("mailbox_id", data.mailboxId)
        .eq("created_by", context.userId)
        .gt("expires_at", new Date().toISOString())
        .in(
          "storage_key",
          attachments.map((file) => file.storageKey),
        );
      const reservationsByKey = new Map(
        (reservations ?? []).map((file: any) => [file.storage_key, file]),
      );
      const reservationsMatch = attachments.every((file) => {
        const reserved: any = reservationsByKey.get(file.storageKey);
        return (
          reserved &&
          reserved.file_name === file.fileName &&
          reserved.content_type === file.contentType &&
          Number(reserved.size_bytes) === file.sizeBytes &&
          reserved.sha256 === file.sha256
        );
      });
      if (reservationError || reservationsByKey.size !== attachments.length || !reservationsMatch)
        throw new Error("ATTACHMENT_RESERVATION_INVALID");
    }
    const { data: config } = await db
      .from("email_delivery_config")
      .select("mode")
      .eq("id", true)
      .maybeSingle();
    const status = config?.mode === "live" ? "pending" : "held";
    const { data: queued, error } = await db
      .from("corporate_mail_send_queue")
      .insert({
        mailbox_id: data.mailboxId,
        created_by: context.userId,
        in_reply_to_message_id: data.replyToId ?? null,
        recipient_addresses: recipients,
        cc_addresses: cc,
        subject: data.subject.trim(),
        body_text: body,
        body_html: `${messageHtml}${corporateSignatureHtml(signatureInput)}`,
        status: "held",
      })
      .select("id")
      .single();
    if (error) throw new Error("MAIL_QUEUE_FAILED");
    if (attachments.length) {
      const { error: attachmentError } = await db.from("corporate_mail_attachments").insert(
        attachments.map((file) => ({
          send_queue_id: queued.id,
          storage_key: file.storageKey,
          file_name: file.fileName,
          content_type: file.contentType,
          size_bytes: file.sizeBytes,
          sha256: file.sha256,
        })),
      );
      if (attachmentError) {
        await db.from("corporate_mail_send_queue").delete().eq("id", queued.id);
        await db.storage.from("corporate-mail").remove(attachments.map((file) => file.storageKey));
        throw new Error("MAIL_ATTACHMENT_SAVE_FAILED");
      }
      await db
        .from("corporate_mail_uploads")
        .delete()
        .eq("mailbox_id", data.mailboxId)
        .eq("created_by", context.userId)
        .in(
          "storage_key",
          attachments.map((file) => file.storageKey),
        );
    }
    const { error: releaseError } = await db
      .from("corporate_mail_send_queue")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", queued.id)
      .eq("status", "held");
    if (releaseError) throw new Error("MAIL_QUEUE_RELEASE_FAILED");
    if (data.draftId && uuid.test(data.draftId)) {
      await db
        .from("corporate_mail_drafts")
        .delete()
        .eq("id", data.draftId)
        .eq("created_by", context.userId);
    }
    await log(db, context.userId, "platform.mail.queue", queued.id, {
      mailboxId: data.mailboxId,
      recipientCount: recipients.length,
      reply: Boolean(data.replyToId),
      status,
    });
    return { ok: true, id: queued.id, status };
  });

export const saveCorporateMailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      mailboxId: string;
      recipients: string[];
      cc: string[];
      subject: string;
      body: string;
      bodyHtml: string;
      replyToId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (
      !["reply", "manage"].includes(access.permission) ||
      data.body.length > 50000 ||
      data.bodyHtml.length > 100000 ||
      data.subject.length > 500
    )
      throw new Error("INVALID_DRAFT");
    const row = {
      mailbox_id: data.mailboxId,
      created_by: context.userId,
      in_reply_to_message_id: data.replyToId && uuid.test(data.replyToId) ? data.replyToId : null,
      recipient_addresses: data.recipients
        .map((value) => value.trim().toLowerCase())
        .filter((value) => emailPattern.test(value))
        .slice(0, 25),
      cc_addresses: data.cc
        .map((value) => value.trim().toLowerCase())
        .filter((value) => emailPattern.test(value))
        .slice(0, 25),
      subject: data.subject.trim().slice(0, 500),
      body_text: data.body.slice(0, 50000),
      body_html: composedMailHtml(data.bodyHtml, data.body),
      updated_at: new Date().toISOString(),
    };
    const query =
      data.id && uuid.test(data.id)
        ? db
            .from("corporate_mail_drafts")
            .update(row)
            .eq("id", data.id)
            .eq("created_by", context.userId)
        : db.from("corporate_mail_drafts").insert(row);
    const { data: saved, error } = await query.select("id,updated_at").single();
    if (error) throw new Error("DRAFT_SAVE_FAILED");
    return saved;
  });

export const deleteCorporateMailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.id)) throw new Error("INVALID_DRAFT");
    const db = await staffDb(context.userId);
    await mailboxPermission(db, context.userId, data.mailboxId);
    const { error } = await db
      .from("corporate_mail_drafts")
      .delete()
      .eq("id", data.id)
      .eq("mailbox_id", data.mailboxId)
      .eq("created_by", context.userId);
    if (error) throw new Error("DRAFT_DELETE_FAILED");
    return { ok: true };
  });

export const translateCorporateMailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { mailboxId: string; text: string; source: "auto" | "nl" | "en"; target: "nl" | "en"; format?: "text" | "html" }) => input,
  )
  .handler(async ({ data, context }) => {
    const value = data.text.trim();
    if (value.length < 2 || value.length > 30000 || data.source === data.target)
      throw new Error("INVALID_TRANSLATION_REQUEST");
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (!["reply", "manage"].includes(access.permission)) throw new Error("FORBIDDEN");
    const endpoint = process.env["TRANSLATION_API_URL"]?.trim();
    if (!endpoint) throw new Error("TRANSLATION_NOT_CONFIGURED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const apiKey = process.env["TRANSLATION_API_KEY"]?.trim();
      // Splitting HTML at an arbitrary character can cut a tag in half and
      // makes the translated result impossible to render as an email.
      const chunks = data.format === "html" ? [value] : value.match(/[\s\S]{1,4500}(?:\n\n|\n|\s|$)/g) ?? [value];
      const translated: string[] = [];
      for (const chunk of chunks) {
        const translate = (source: "auto" | "nl" | "en") => fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            q: chunk,
            source,
            target: data.target,
            format: data.format === "html" ? "html" : "text",
            api_key: apiKey || undefined,
          }),
          signal: controller.signal,
        });
        let response = await translate(data.source);
        if (!response.ok && data.source === "auto") response = await translate(data.target === "en" ? "nl" : "en");
        if (!response.ok) throw new Error(`TRANSLATION_PROVIDER_FAILED_${response.status}`);
        const result = (await response.json()) as { translatedText?: string; translation?: string };
        const resultText = (result.translatedText ?? result.translation ?? "").trim();
        if (!resultText) throw new Error("TRANSLATION_PROVIDER_INVALID");
        translated.push(resultText);
      }
      const result = translated.join("\n\n");
      if (result.length > 40000) throw new Error("TRANSLATION_PROVIDER_INVALID");
      return { translated: result };
    } finally {
      clearTimeout(timer);
    }
  });

export const retryCorporateMailDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; messageId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || !uuid.test(data.messageId)) throw new Error("INVALID_MAIL_MESSAGE");
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (!["reply", "manage"].includes(access.permission)) throw new Error("FORBIDDEN");
    const { data: config } = await db.from("email_delivery_config").select("mode").eq("id", true).maybeSingle();
    const { data: retried, error } = await db
      .from("corporate_mail_send_queue")
      .update({
        status: config?.mode === "live" ? "pending" : "held",
        attempts: 0,
        last_error_code: null,
        available_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.messageId)
      .eq("mailbox_id", data.mailboxId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (error || !retried) throw new Error("MAIL_RETRY_NOT_ALLOWED");
    await log(db, context.userId, "platform.corporate_mail.delivery.retry", data.messageId, { mailboxId: data.mailboxId });
    return { ok: true, status: config?.mode === "live" ? "pending" : "held" };
  });

export const updateCorporateMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      mailboxId: string;
      messageId: string;
      action: "read" | "unread" | "archive" | "restore";
      messageIds?: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    await mailboxPermission(db, context.userId, data.mailboxId);
    const ids = data.messageIds ?? [data.messageId];
    if (!ids.length || ids.length > 250 || ids.some((id) => !uuid.test(id)) ||
      !["read", "unread", "archive", "restore"].includes(data.action)) throw new Error("INVALID_MAIL_ACTION");
    const changes =
      data.action === "archive"
        ? { archived_at: new Date().toISOString() }
        : data.action === "restore"
          ? { archived_at: null }
          : data.action === "read"
            ? { read_at: new Date().toISOString() }
            : { read_at: null };
    const { error } = await db
      .from("corporate_mail_messages")
      .update(changes)
      .in("id", ids)
      .eq("mailbox_id", data.mailboxId);
    if (error) throw new Error("MAIL_UPDATE_FAILED");
    return { ok: true };
  });

export const setCorporateMailRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; messageId: string; hold: boolean; reason?: string; reviewAt?: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || !uuid.test(data.messageId) || typeof data.hold !== "boolean") throw new Error("INVALID_MAIL_MESSAGE");
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (access.permission !== "manage") throw new Error("FORBIDDEN");
    const { data: message, error: lookupError } = await db.from("corporate_mail_messages").select("id").eq("id", data.messageId).eq("mailbox_id", data.mailboxId).maybeSingle();
    if (lookupError || !message) throw new Error("MAIL_NOT_FOUND");
    const { error } = await db.rpc("set_corporate_mail_retention", { p_message: data.messageId, p_hold: data.hold, p_reason: data.reason || null, p_review_at: data.reviewAt || null });
    if (error) throw new Error("MAIL_RETENTION_UPDATE_FAILED");
    await log(db, context.userId, "platform.corporate_mail.retention", data.messageId, { hold: data.hold });
    return { ok: true };
  });

export const deleteCorporateMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { mailboxId: string; messageId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.mailboxId) || !uuid.test(data.messageId))
      throw new Error("INVALID_MAIL_MESSAGE");
    const db = await staffDb(context.userId);
    const access = await mailboxPermission(db, context.userId, data.mailboxId);
    if (access.permission !== "manage") throw new Error("FORBIDDEN");
    const { data: message } = await db
      .from("corporate_mail_messages")
      .select("id,archived_at,retention_hold")
      .eq("id", data.messageId)
      .eq("mailbox_id", data.mailboxId)
      .maybeSingle();
    if (!message?.archived_at) throw new Error("MAIL_MESSAGE_NOT_ARCHIVED");
    if (message.retention_hold) throw new Error("MAIL_HELD");
    const { data: jobId, error } = await db.rpc("request_corporate_mail_cleanup", {
      p_message: data.messageId, p_mailbox: data.mailboxId,
    });
    if (error || !jobId) throw new Error("MAIL_DELETE_FAILED");
    await log(db, context.userId, "platform.corporate_mail.message.delete_requested", data.messageId, {
      mailboxId: data.mailboxId, jobId,
    });
    return { ok: true, pending: true };

  });

export const getCorporateFinanceData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { days?: number }) => input ?? {})
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId, "finance");
    const days = Math.min(366, Math.max(7, Math.floor(data.days ?? 30)));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [invoices, subscriptions, transactions, webhooks, entitlements, refunds] = await Promise.all([
      db.from("corporate_invoices").select("*").order("issued_at", { ascending: false }).limit(500),
      db
        .from("billing_subscriptions")
        .select(
          "id,plan,status,currency,recurring_total_minor,billing_interval,current_period_end,created_at",
        ),
      db
        .from("billing_transactions")
        .select("id,provider_transaction_id,status,currency,total_minor,refunded_minor,occurred_at")
        .gte("occurred_at", since)
        .order("occurred_at"),
      db
        .from("billing_webhook_events")
        .select(
          "id,provider_event_id,event_type,status,attempts,last_error_code,received_at,processed_at",
        )
        .in("status", ["received", "processing", "failed"]),
      db.from("billing_entitlements").select("id").gt("ends_at", new Date().toISOString()),
      db.from("billing_refund_requests").select("*").order("created_at",{ascending:false}).limit(200),
    ]);
    if (
      invoices.error || subscriptions.error || transactions.error || webhooks.error ||
      entitlements.error || refunds.error
    )
      throw new Error("FINANCE_DATA_UNAVAILABLE");
    const subs = subscriptions.data ?? [],
      tx = transactions.data ?? [];
    const completed = tx.filter((x: any) =>
      ["paid", "completed", "refunded", "partially_refunded"].includes(x.status),
    );
    const revenueMinor = completed.reduce(
      (sum: number, x: any) => sum + Number(x.total_minor) - Number(x.refunded_minor || 0),
      0,
    );
    const refundedMinor = completed.reduce(
      (sum: number, x: any) => sum + Number(x.refunded_minor || 0),
      0,
    );
    const mrrMinor = subs
      .filter((x: any) => ["trialing", "active", "past_due"].includes(x.status))
      .reduce(
        (sum: number, x: any) =>
          sum +
          Math.round(
            Number(x.recurring_total_minor) * (x.billing_interval === "year" ? 1 / 12 : 1),
          ),
        0,
      );
    const daily = new Map<string, number>();
    for (const x of completed) {
      const day = String(x.occurred_at).slice(0, 10);
      daily.set(day, (daily.get(day) ?? 0) + Number(x.total_minor) - Number(x.refunded_minor || 0));
    }
    return {
      days,
      invoices: invoices.data ?? [],
      subscriptions: subs,
      transactions: tx,
      webhooks: webhooks.data ?? [],
      refundRequests: refunds.data ?? [],
      metrics: {
        mrrMinor,
        revenueMinor,
        refundedMinor,
        activeSubscriptions: subs.filter((x: any) => x.status === "active").length,
        pastDue: subs.filter((x: any) => x.status === "past_due").length,
        pendingWebhooks: (webhooks.data ?? []).length,
        activePrepaidAccesses: (entitlements.data ?? []).length,
      },
      dailyRevenue: Array.from(daily, ([date, totalMinor]) => ({ date, totalMinor })),
    };
  });

export const getPaddleTransactionDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { transactionId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^txn_[a-z0-9]{10,}$/i.test(data.transactionId)) throw new Error("INVALID_TRANSACTION_ID");
    const db = await dbFor(context.userId, "finance");
    const [transactionResult, eventsResult, entitlementResult] = await Promise.all([
      db
        .from("billing_transactions")
        .select("id,customer_id,provider_transaction_id,status,total_minor,currency,occurred_at")
        .eq("provider_transaction_id", data.transactionId)
        .maybeSingle(),
      db
        .from("billing_webhook_events")
        .select(
          "provider_event_id,event_type,status,attempts,last_error_code,received_at,processed_at,payload",
        )
        .contains("payload", { data: { id: data.transactionId } })
        .order("received_at", { ascending: false })
        .limit(10),
      db
        .from("billing_entitlements")
        .select("plan,starts_at,ends_at,workspace_uuid")
        .eq("provider_transaction_id", data.transactionId)
        .maybeSingle(),
    ]);
    if (transactionResult.error || eventsResult.error || entitlementResult.error)
      throw new Error("PADDLE_DIAGNOSIS_UNAVAILABLE");
    const transaction = transactionResult.data;
    const events = eventsResult.data ?? [];
    const event =
      events.find((item: any) => item.event_type === "transaction.completed") ?? events[0];
    const eventData = event?.payload?.data ?? {};
    const providerCustomerId = eventData.customer_id;
    const customerQuery = db
      .from("billing_customers")
      .select("id,workspace_uuid,provider_customer_id,billing_email");
    const { data: customer, error: customerError } = transaction?.customer_id
      ? await customerQuery.eq("id", transaction.customer_id).maybeSingle()
      : providerCustomerId
        ? await customerQuery.eq("provider_customer_id", providerCustomerId).maybeSingle()
        : { data: null, error: null };
    if (customerError) throw new Error("PADDLE_DIAGNOSIS_UNAVAILABLE");
    const eventWorkspace =
      eventData.custom_data?.workspace_uuid ?? eventData.custom_data?.workspaceUuid;
    const workspaceId =
      customer?.workspace_uuid ?? entitlementResult.data?.workspace_uuid ?? eventWorkspace ?? null;
    const { data: workspace, error: workspaceError } =
      workspaceId && uuid.test(workspaceId)
        ? await db
            .from("workspaces")
            .select("workspace_uuid,user_id,plan")
            .eq("workspace_uuid", workspaceId)
            .maybeSingle()
        : { data: null, error: null };
    if (workspaceError) throw new Error("PADDLE_DIAGNOSIS_UNAVAILABLE");
    const { data: subscription, error: subscriptionError } = customer
      ? await db
          .from("billing_subscriptions")
          .select("provider_subscription_id,plan,status,current_period_end,updated_at")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };
    if (subscriptionError) throw new Error("PADDLE_DIAGNOSIS_UNAVAILABLE");
    const { data: owner } = workspace?.user_id
      ? await db.auth.admin.getUserById(workspace.user_id)
      : { data: null };
    const billingMode =
      eventData.globetrotr_billing_mode || (entitlementResult.data ? "one_time" : null);
    const expectedPlan =
      eventData.globetrotr_plan || entitlementResult.data?.plan || subscription?.plan || null;
    const state = classifyPaddleDiagnosis({
      transactionStatus: transaction?.status,
      webhookFailed: events.some((item: any) => item.status === "failed"),
      workspaceConflict: Boolean(
        customer?.workspace_uuid && eventWorkspace && customer.workspace_uuid !== eventWorkspace,
      ),
      billingMode,
      expectedPlan,
      workspacePlan: workspace?.plan,
      entitlementEndsAt: entitlementResult.data?.ends_at,
      subscriptionStatus: subscription?.status,
      subscriptionPlan: subscription?.plan,
    });
    return {
      state,
      transaction,
      customer: customer
        ? { id: customer.provider_customer_id, email: customer.billing_email }
        : null,
      workspace: workspace
        ? {
            id: workspace.workspace_uuid,
            plan: workspace.plan,
            ownerEmail: owner?.user?.email ?? null,
          }
        : null,
      entitlement: entitlementResult.data,
      subscription,
      billingMode,
      expectedPlan,
      events: events.map((item: any) => ({
        eventId: item.provider_event_id,
        type: item.event_type,
        status: item.status,
        attempts: item.attempts,
        errorCode: item.last_error_code,
        receivedAt: item.received_at,
        processedAt: item.processed_at,
      })),
    };
  });

/** Recovers a missing one-time webhook only from Paddle's authenticated API and
 * the original server-signed checkout binding. Customer email is never used to
 * decide which workspace receives access. */
export const recoverPaddleOneTimeTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { transactionId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^txn_[a-z0-9]{10,}$/i.test(data.transactionId) ||
        data.reason.trim().length < 10 || data.reason.trim().length > 500)
      throw new Error("INVALID_RECOVERY_REQUEST");
    const db = await dbFor(context.userId, "finance");
    const apiKey = process.env.PADDLE_API_KEY?.trim();
    const bindingSecret = process.env.PADDLE_CHECKOUT_BINDING_SECRET?.trim();
    if (!apiKey || !bindingSecret) throw new Error("PADDLE_NOT_CONFIGURED");
    const { matchOneTimePaddlePrice, verifiedCheckoutWorkspace } = await import("./paddle-recovery");
    const base = process.env.VITE_PADDLE_ENVIRONMENT === "production"
      ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
    const response = await fetch(`${base}/transactions/${encodeURIComponent(data.transactionId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`PADDLE_TRANSACTION_${response.status}`);
    const transaction = (await response.json())?.data;
    if (transaction?.id !== data.transactionId || transaction.status !== "completed" ||
        transaction.origin !== "web") throw new Error("PADDLE_TRANSACTION_NOT_ELIGIBLE");
    const plan = matchOneTimePaddlePrice(transaction.items, {
      pro: process.env.VITE_PADDLE_PRO_ONETIME_PRICE_ID,
      agency: process.env.VITE_PADDLE_AGENCY_ONETIME_PRICE_ID,
    });
    if (!plan) throw new Error("PADDLE_PRICE_NOT_ALLOWED");
    const workspaceId = verifiedCheckoutWorkspace(
      transaction.custom_data?.checkout_binding, bindingSecret, plan, "one_time",
    );
    if (!workspaceId) throw new Error("PADDLE_BINDING_INVALID");
    const { data: workspace, error: workspaceError } = await db.from("workspaces")
      .select("workspace_uuid")
      .eq("workspace_uuid", workspaceId).maybeSingle();
    if (workspaceError || !workspace) throw new Error("PADDLE_WORKSPACE_NOT_FOUND");
    const { data: existing, error: existingError } = await db.from("billing_transactions")
      .select("id").eq("provider_transaction_id", data.transactionId).maybeSingle();
    if (existingError || existing) throw new Error("PADDLE_TRANSACTION_ALREADY_RECORDED");
    if (transaction.customer_id) {
      const { data: linkedCustomer, error: customerError } = await db.from("billing_customers")
        .select("workspace_uuid").eq("provider_customer_id", transaction.customer_id).maybeSingle();
      if (customerError || (linkedCustomer && linkedCustomer.workspace_uuid !== workspaceId))
        throw new Error("PADDLE_CUSTOMER_WORKSPACE_CONFLICT");
    }
    const totals = transaction.details?.totals;
    if (!totals || !/^\d+$/.test(String(totals.total)) ||
        !/^\d+$/.test(String(totals.credit ?? "0")) ||
        BigInt(totals.credit ?? "0") > 0n)
      throw new Error("PADDLE_TRANSACTION_CREDITED");
    const adjustmentsResponse = await fetch(
      `${base}/adjustments?transaction_id=${encodeURIComponent(data.transactionId)}&per_page=50`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) },
    );
    if (!adjustmentsResponse.ok) throw new Error(`PADDLE_ADJUSTMENTS_${adjustmentsResponse.status}`);
    const adjustments = await adjustmentsResponse.json();
    if (adjustments.meta?.pagination?.has_more || !Array.isArray(adjustments.data) ||
        adjustments.data.some((item: any) =>
          ["refund", "credit", "chargeback"].includes(item.action) &&
          !["rejected", "reversed"].includes(item.status)))
      throw new Error("PADDLE_TRANSACTION_ADJUSTED");
    const event = {
      event_id: `reconciled:${data.transactionId}`,
      event_type: "transaction.completed",
      occurred_at: transaction.billed_at || transaction.created_at || new Date().toISOString(),
      data: {
        ...transaction,
        globetrotr_plan: plan,
        globetrotr_billing_mode: "one_time",
        custom_data: { ...transaction.custom_data, workspace_uuid: workspaceId },
      },
    };
    const { data: result, error } = await db.rpc("process_paddle_billing_event", { p_event: event });
    if (error || !["processed", "duplicate"].includes(result)) throw new Error("PADDLE_RECOVERY_FAILED");
    const { error: entitlementError } = await db.rpc("apply_paddle_one_time_purchase", { p_event: event });
    if (entitlementError) throw new Error("PADDLE_ENTITLEMENT_RECOVERY_FAILED");
    await log(db, context.userId, "billing.transaction.recover", data.transactionId, {
      reason: data.reason.trim(), workspaceId, plan, result,
    });
    return { ok: true, workspaceId, plan };
  });

export const refundPaddleTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { requestId: string; action: "approve" | "reject"; reviewNote: string }) => input)
  .handler(async ({ data, context }) => {
    const reviewNote = data.reviewNote.trim();
    if (!/^[0-9a-f-]{36}$/i.test(data.requestId) || !["approve","reject"].includes(data.action) || reviewNote.length < 3 || reviewNote.length > 500)
      throw new Error("INVALID_REFUND_REQUEST");
    const db = await dbFor(context.userId, "finance");
    const { data: request } = await db.from("billing_refund_requests").select("*").eq("id",data.requestId).eq("status","pending").maybeSingle();
    if (!request) throw new Error("REFUND_REQUEST_NOT_PENDING");
    const { data: transaction } = await db.from("billing_transactions").select("id,status,total_minor,refunded_minor").eq("id",request.transaction_id).maybeSingle();
    if (
      !transaction ||
      transaction.status !== "completed" ||
      Number(transaction.total_minor) <= 0 ||
      Number(transaction.refunded_minor) > 0
    )
      throw new Error("TRANSACTION_NOT_REFUNDABLE");
    if (data.action === "reject") {
      const { data: updated, error: updateError } = await db.from("billing_refund_requests").update({status:"rejected",reviewed_by:context.userId,reviewed_at:new Date().toISOString(),review_note:reviewNote,updated_at:new Date().toISOString()}).eq("id",request.id).eq("status","pending").select("id").maybeSingle();
      if (updateError || !updated) throw new Error("REFUND_REQUEST_NOT_PENDING");
      const { data: profile } = await db.from("profiles").select("locale").eq("id",request.requested_by).maybeSingle();
      const nl = mailLocale(profile?.locale) === "nl";
      await db.from("notifications").insert({user_id:request.requested_by,kind:"account",title:nl ? "Terugbetaling afgewezen" : "Refund rejected",body:nl ? `Je verzoek is afgewezen: ${reviewNote}` : `Your request was rejected: ${reviewNote}`,event_key:`refund-reviewed:${request.id}`});
      await log(db,context.userId,"billing.refund.reject",transaction.id,{requestId:request.id,reviewNote});
      return {ok:true,status:"rejected"};
    }
    const apiKey = process.env.PADDLE_API_KEY?.trim();
    if (!apiKey) throw new Error("PADDLE_NOT_CONFIGURED");
    const base =
      process.env.VITE_PADDLE_ENVIRONMENT === "production"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com";
    const response = await fetch(`${base}/adjustments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refund",
        type: "full",
        transaction_id: request.provider_transaction_id,
        reason: "requested_by_customer",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`PADDLE_REFUND_${response.status}`);
    const result = (await response.json()) as { data?: { id?: string; status?: string } };
    const { data: updated, error: updateError } = await db.from("billing_refund_requests").update({status:"submitted",reviewed_by:context.userId,reviewed_at:new Date().toISOString(),review_note:reviewNote,provider_adjustment_id:result.data?.id,provider_status:result.data?.status,updated_at:new Date().toISOString()}).eq("id",request.id).eq("status","pending").select("id").maybeSingle();
    if (updateError || !updated) throw new Error("REFUND_REQUEST_NOT_PENDING");
    const { data: profile } = await db.from("profiles").select("locale").eq("id",request.requested_by).maybeSingle();
    const nl = mailLocale(profile?.locale) === "nl";
    await db.from("notifications").insert({user_id:request.requested_by,kind:"account",title:nl ? "Terugbetaling goedgekeurd" : "Refund approved",body:nl ? "Paddle verwerkt de terugbetaling." : "Paddle is processing the refund.",event_key:`refund-approved:${request.id}`});
    await log(db, context.userId, "billing.refund.approve", transaction.id, {
      providerTransactionId: request.provider_transaction_id,
      adjustmentId: result.data?.id,
      status: result.data?.status,
      requestId: request.id, reviewNote,
    });
    return { ok: true, status: result.data?.status ?? "pending_approval" };
  });

export const retryPaddleWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { eventId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    if (!/^(?:evt_[a-z0-9]{10,}|reconciled:txn_[a-z0-9]{10,})$/i.test(data.eventId) || data.reason.trim().length < 10)
      throw new Error("INVALID_WEBHOOK_RETRY");
    const db = await dbFor(context.userId, "finance");
    const { data: event } = await db
      .from("billing_webhook_events")
      .select("payload,status")
      .eq("provider_event_id", data.eventId)
      .maybeSingle();
    const oneTimeRepair =
      event?.status === "processed" &&
      event.payload?.event_type === "transaction.completed" &&
      event.payload?.data?.globetrotr_billing_mode === "one_time";
    if (!event || (event.status !== "failed" && !oneTimeRepair))
      throw new Error("WEBHOOK_NOT_RETRYABLE");
    const eventWorkspace =
      event.payload?.data?.custom_data?.workspace_uuid ??
      event.payload?.data?.custom_data?.workspaceUuid;
    const providerCustomerId = event.payload?.data?.customer_id;
    if (eventWorkspace && providerCustomerId) {
      const { data: linkedCustomer, error: customerError } = await db
        .from("billing_customers")
        .select("workspace_uuid")
        .eq("provider_customer_id", providerCustomerId)
        .maybeSingle();
      if (customerError) throw new Error("WEBHOOK_CUSTOMER_CHECK_FAILED");
      if (linkedCustomer && linkedCustomer.workspace_uuid !== eventWorkspace)
        throw new Error("WEBHOOK_WORKSPACE_CONFLICT");
    }
    const { data: result, error } = await db.rpc("process_paddle_billing_event", {
      p_event: event.payload,
    });
    if (error || !["processed", "duplicate"].includes(result))
      throw new Error("WEBHOOK_RETRY_FAILED");
    if (event.payload?.data?.globetrotr_billing_mode === "one_time") {
      const { error: entitlementError } = await db.rpc("apply_paddle_one_time_purchase", {
        p_event: event.payload,
      });
      if (entitlementError) throw new Error("ENTITLEMENT_REPAIR_FAILED");
    }
    await log(db, context.userId, "billing.webhook.retry", data.eventId, {
      reason: data.reason.trim(),
      result,
    });
    return { ok: true, result };
  });

export const getCorporateStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await dbFor(context.userId, "users");
    const [admins, profiles, mailboxes, authUsers, jobs] = await Promise.all([
      db
        .from("platform_admins")
        .select("user_id,role,active,job_title,permissions,created_at,updated_at,deactivated_at")
        .order("created_at"),
      db.from("profiles").select("id,display_name,email"),
      db
        .from("corporate_mailboxes")
        .select(
          "id,address,owner_user_id,mailbox_type,active,hosting_mode,provisioning_status,provisioning_error_code,sync_status,last_synced_at,last_sync_error_code",
        ),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      db
        .from("staff_identity_provisioning")
        .select(
          "user_id,status,error_code,invitation_status,invited_at,updated_at,attempts,first_team_login_at,removal_requested_at",
        ),
    ]);
    if (admins.error || profiles.error || mailboxes.error || authUsers.error || jobs.error)
      throw new Error("STAFF_DATA_UNAVAILABLE");
    const profilesById = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    return {
      automationEnabled: process.env.STAFF_AUTOMATION_ENABLED === "true",
      canManage: (admins.data ?? []).some(
        (a: any) => a.user_id === context.userId && a.active && a.role === "owner",
      ),
      staff: [
        ...(admins.data ?? []),
        ...(jobs.data ?? []).filter((j: any) =>
          (j.status === "disabled" || j.removal_requested_at) &&
          !(admins.data ?? []).some((a: any) => a.user_id === j.user_id),
        ).map((j: any) => ({ user_id: j.user_id, role: "support", active: false,
          job_title: "", permissions: {}, cleanupOnly: true })),
      ].map((a: any) => {
        const p: any = profilesById.get(a.user_id),
          u = authUsers.data.users.find((x: any) => x.id === a.user_id);
        return {
          ...a,
          name: p?.display_name || u?.user_metadata?.full_name || "",
          accountEmail: p?.email || u?.email || "",
          identityProvisioning: (jobs.data ?? []).find((j: any) => j.user_id === a.user_id) ?? null,
          mailbox:
            (mailboxes.data ?? []).find(
              (m: any) => m.owner_user_id === a.user_id && m.mailbox_type === "personal",
            ) ?? null,
        };
      }),
      candidates: authUsers.data.users.map((u: any) => {
        const p: any = profilesById.get(u.id);
        return {
          id: u.id,
          name: p?.display_name || u.user_metadata?.full_name || "",
          email: p?.email || u.email || "",
        };
      }),
      sharedMailboxes: (mailboxes.data ?? []).filter((m: any) => m.mailbox_type === "shared"),
    };
  });

function suggestedMailbox(name: string) {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return "";
  return `${parts[0][0]}.${parts.at(-1)!.replace(/-/g, "")}@globetrotr.nl`;
}
export const suggestCorporateMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { name: string }) => input)
  .handler(async ({ data, context }) => {
    await dbFor(context.userId, "users");
    return { address: suggestedMailbox(data.name) };
  });

export const inviteCorporateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      email: string;
      name: string;
      provisioning?: {
        role: "owner" | "admin" | "support";
        permissions: Record<string, boolean>;
        mailboxAddress: string;
        reason: string;
        jobTitle: string;
      };
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId, "users");
    const actor = await db
      .from("platform_admins")
      .select("role")
      .eq("user_id", context.userId)
      .eq("active", true)
      .single();
    if (actor.error || actor.data?.role !== "owner") throw new Error("OWNER_REQUIRED");
    const email = data.email.trim().toLowerCase(),
      name = data.name.trim();
    if (!emailPattern.test(email) || name.length < 2 || name.length > 120)
      throw new Error("INVALID_STAFF_INVITE");
    const automate = process.env.STAFF_AUTOMATION_ENABLED === "true";
    if (automate && name.length > 100) throw new Error("INVALID_STAFF_INVITE");
    const setup = automate ? data.provisioning : undefined;
    let initialCiphertext: string | null = null;
    if (setup) {
      if (
        !["owner", "admin", "support"].includes(setup.role) ||
        !addressPattern.test(setup.mailboxAddress || "") ||
        typeof setup.reason !== "string" ||
        setup.reason.trim().length < 10 ||
        setup.reason.length > 500 ||
        typeof setup.jobTitle !== "string" ||
        setup.jobTitle.length > 100 ||
        !setup.permissions ||
        typeof setup.permissions !== "object" ||
        Object.entries(setup.permissions).some(
          ([key, value]) =>
            !["users", "agencies", "finance", "mail", "operations", "issues"].includes(key) ||
            typeof value !== "boolean",
        )
      )
        throw new Error("INVALID_STAFF");
      if (email === setup.mailboxAddress) throw new Error("STAFF_CONTACT_EMAIL_EQUALS_NEW_MAILBOX");
      const occupied = await db
        .from("corporate_mailboxes")
        .select("id")
        .eq("address", setup.mailboxAddress)
        .maybeSingle();
      if (occupied.error) throw new Error("STAFF_DATA_UNAVAILABLE");
      if (occupied.data) throw new Error("STAFF_MAILBOX_IN_USE");
      const { randomBytes } = await import("node:crypto");
      const { encryptSecret } = await import("./secret-crypto.server");
      initialCiphertext = encryptSecret(randomBytes(36).toString("base64url"));
    }
    const audit = await db.from("platform_admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "platform.staff.invite_requested",
      target_type: "user",
      target_id: null,
      result: "success",
      details: { emailDomain: email.split("@")[1], automation: automate },
    });
    if (audit.error) throw new Error("STAFF_AUDIT_FAILED");
    const { data: invited, error } = automate
      ? await db.auth.admin.createUser({
          email,
          // Reserve the original GBT identity for verified OAuth email linking.
          // No local password or access is issued; the recovery flow verifies
          // the mailbox and MFA before this identity can establish staff proof.
          email_confirm: true,
          user_metadata: { full_name: name, language: "en" },
        })
      : await db.auth.admin.inviteUserByEmail(email, {
          data: { full_name: name, language: "en" },
          redirectTo: "https://portal.globetrotr.nl/auth",
        });
    if (error || !invited.user) throw new Error("STAFF_INVITE_FAILED");
    let setupError: string | undefined;
    if (setup) {
      const saved = await db.rpc("save_corporate_staff_atomic", {
        p_actor: context.userId,
        p_user: invited.user.id,
        p_role: setup.role,
        p_active: true,
        p_job_title: setup.jobTitle,
        p_permissions: setup.permissions,
        p_mailbox_address: setup.mailboxAddress,
        p_reason: setup.reason,
        p_automate: true,
        p_initial_ciphertext: initialCiphertext,
      });
      if (saved.error)
        setupError = [
          "STAFF_MAILBOX_IN_USE",
          "OWNER_REQUIRED",
          "STAFF_CONTACT_EMAIL_EQUALS_NEW_MAILBOX",
          "INVALID_STAFF",
        ].includes(saved.error.message)
          ? saved.error.message
          : "STAFF_ACCOUNT_PREPARED_SAVE_FAILED";
    }
    const finished = await db.from("platform_admin_audit_log").insert({
      actor_user_id: context.userId,
      action: automate ? "platform.staff.account_prepared" : "platform.staff.invite",
      target_type: "user",
      target_id: invited.user.id,
      result: setupError ? "failure" : "success",
      details: {
        emailDomain: email.split("@")[1],
        onboardingQueued: Boolean(setup && !setupError),
        errorCode: setupError,
      },
    });
    if (finished.error) throw new Error("STAFF_AUDIT_FAILED");
    return {
      ok: true,
      userId: invited.user.id,
      invitationSent: !automate,
      provisioningQueued: Boolean(setup && !setupError),
      setupError,
    };
  });

export const retryCorporateStaffIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; invite: boolean }) => {
    if (!uuid.test(input?.userId || "") || typeof input.invite !== "boolean")
      throw new Error("INVALID_STAFF");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId);
    if (process.env.STAFF_AUTOMATION_ENABLED !== "true")
      throw new Error("STAFF_AUTOMATION_DISABLED");
    const result = await db.rpc("request_staff_identity", {
      p_actor: context.userId,
      p_user: data.userId,
      p_invite: data.invite,
    });
    if (result.error)
      throw new Error(
        [
          "OWNER_REQUIRED",
          "ACTIVE_STAFF_REQUIRED",
          "STAFF_INVITE_THROTTLED",
          "STAFF_EXISTING_IDENTITY_REQUIRES_MANUAL_LINK",
        ].includes(result.error.message)
          ? result.error.message
          : "STAFF_REQUEST_FAILED",
      );
    return { ok: true };
  });

export const saveCorporateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      userId: string;
      role: "owner" | "admin" | "support";
      jobTitle: string;
      active: boolean;
      permissions: Record<string, boolean>;
      mailboxAddress: string;
      reason: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const db = await dbFor(context.userId);
    const { data: actor } = await db
      .from("platform_admins")
      .select("role")
      .eq("user_id", context.userId)
      .eq("active", true)
      .single();
    if (actor?.role !== "owner") throw new Error("OWNER_REQUIRED");
    if (
      !uuid.test(data.userId) ||
      data.reason.trim().length < 10 ||
      data.jobTitle.length > 100 ||
      (data.mailboxAddress && !addressPattern.test(data.mailboxAddress.trim().toLowerCase()))
    )
      throw new Error("INVALID_STAFF");
    if (data.userId === context.userId && !data.active) throw new Error("CANNOT_DEACTIVATE_SELF");
    if (!data.active) {
      const { count } = await db
        .from("platform_admins")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "owner")
        .eq("active", true);
      const { data: target } = await db
        .from("platform_admins")
        .select("role")
        .eq("user_id", data.userId)
        .maybeSingle();
      if (target?.role === "owner" && (count ?? 0) <= 1) throw new Error("LAST_OWNER");
    }
    const automate = process.env.STAFF_AUTOMATION_ENABLED === "true";
    let initialCiphertext: string | null = null;
    if (automate && data.mailboxAddress) {
      const existing = await db
        .from("corporate_mailboxes")
        .select("id,active,hosting_mode")
        .eq("address", data.mailboxAddress.trim().toLowerCase())
        .maybeSingle();
      if (existing.error) throw new Error("STAFF_MAILBOX_LOOKUP_FAILED");
      if (
        !existing.data ||
        (data.active &&
          existing.data.active === false &&
          existing.data.hosting_mode === "self_hosted")
      ) {
        const { randomBytes } = await import("node:crypto");
        const { encryptSecret } = await import("./secret-crypto.server");
        initialCiphertext = encryptSecret(randomBytes(36).toString("base64url"));
      }
    }
    const result = await db.rpc("save_corporate_staff_atomic", {
      p_actor: context.userId,
      p_user: data.userId,
      p_role: data.role,
      p_active: data.active,
      p_job_title: data.jobTitle.trim(),
      p_permissions: data.permissions,
      p_mailbox_address: data.mailboxAddress.trim().toLowerCase(),
      p_reason: data.reason.trim(),
      p_automate: automate,
      p_initial_ciphertext: initialCiphertext,
    });
    if (result.error) {
      const allowed = [
        "OWNER_REQUIRED",
        "LAST_OWNER",
        "CANNOT_DEACTIVATE_SELF",
        "INVALID_STAFF",
        "USER_NOT_FOUND",
        "STAFF_MAILBOX_IN_USE",
        "STAFF_MAILBOX_RENAME_SEPARATE",
        "STAFF_USERNAME_IMMUTABLE",
        "STAFF_CONTACT_EMAIL_REQUIRED",
        "STAFF_CONTACT_EMAIL_EQUALS_NEW_MAILBOX",
        "MAILBOX_DELETION_PENDING",
        "MAILBOX_CREDENTIAL_CONFIGURATION_REQUIRED",
      ];
      throw new Error(
        allowed.includes(result.error.message) ? result.error.message : "STAFF_SAVE_FAILED",
      );
    }
    return { ok: true, requiresRelogin: true, automationQueued: result.data === true };
  });

export const removeCorporateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateStaffRemoval)
  .handler(async ({ context, data }) => {
    const db = await dbFor(context.userId);
    const actor = await db
      .from("platform_admins")
      .select("role")
      .eq("user_id", context.userId)
      .eq("active", true)
      .single();
    if (actor.error || actor.data?.role !== "owner") throw new Error("OWNER_REQUIRED");
    if (data.userId === context.userId) throw new Error("CANNOT_REMOVE_SELF");
    const removal = await db.rpc("request_staff_removal", {
      p_actor: context.userId, p_user: data.userId, p_reason: data.reason.trim(),
    });
    if (removal.error) {
      const allowed = ["OWNER_REQUIRED", "CANNOT_REMOVE_SELF", "STAFF_NOT_FOUND", "USER_NOT_FOUND",
        "DEACTIVATE_STAFF_FIRST", "STAFF_OFFBOARDING_PENDING", "STAFF_MAIL_OFFBOARDING_PENDING",
        "STAFF_IDENTITY_MANUAL_REMOVAL_REQUIRED", "MAILBOX_RETENTION_BLOCKED", "MAILBOX_STORAGE_SHARED",
        "MAILBOX_BUSY", "MAILBOX_PROTECTED", "MAILBOX_NOT_PROVISIONED", "INVALID_STAFF"];
      throw new Error(allowed.includes(removal.error.message) ? removal.error.message : "STAFF_REMOVE_FAILED");
    }
    return { ok: true, queued: removal.data === true };
  });
export const getMyCorporateCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await dbFor(context.userId);
    const { data } = await db
      .from("platform_admins")
      .select("role,job_title,permissions")
      .eq("user_id", context.userId)
      .eq("active", true)
      .single();
    const all = {
        users: true,
        agencies: true,
        finance: true,
        mail: true,
        operations: true,
        server_ops: false,
        issues: true,
      },
      none = {
        users: false,
        agencies: false,
        finance: false,
        mail: false,
        operations: false,
        server_ops: false,
        issues: false,
      };
    return {
      role: data.role,
      jobTitle: data.job_title,
      permissions: data.role === "owner" ? all : { ...none, ...data.permissions },
    };
  });

export const getCorporateStaffActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.userId)) throw new Error("INVALID_USER");
    const db = await dbFor(context.userId, "users");
    const { data: entries, error } = await db
      .from("platform_admin_audit_log")
      .select("id,actor_user_id,action,result,details,created_at")
      .eq("target_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("STAFF_ACTIVITY_UNAVAILABLE");
    return entries ?? [];
  });
