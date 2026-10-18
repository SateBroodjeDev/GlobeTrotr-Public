import { ImapFlow } from "imapflow";
import { processMailCleanup } from "./corporate-mail-retention.mjs";
import { simpleParser } from "mailparser";
import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { scanBuffer } from "./clamav.mjs";
import { safeImapErrorCode } from "./imap-diagnostics.mjs";
import { bookingSegments, storeBookingDraft } from "./booking-mail-import.mjs";
import { parseBookingMail } from "./booking-mail-parser.mjs";
import {
  mailRecipients,
  routeBookingMail,
  bookingSourceExpiry,
  bookingJunkFolders,
  eligibleJunkBooking,
} from "./booking-mail-policy.mjs";
import { configuredMailTls, configuredMailboxImapHost } from "./mail-tls.mjs";
import { importMailboxReady, corporateJunkFolders, corporateFoldersSupported, pendingCorporateFolderImports } from "./staff-mail-policy.mjs";

const env = process.env,
  supabaseUrl = required("SUPABASE_URL").replace(/\/$/, ""),
  serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const serviceAuthHeaders = {
  apikey: serviceKey,
  ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
};
const interval = bounded(env.IMAP_SYNC_INTERVAL_MS, 60_000, 15_000, 900_000),
  lookback = bounded(env.IMAP_INITIAL_LOOKBACK_DAYS, 14, 1, 90);
const bookingMailEnabled = env.TRIP_BOOKING_MAIL_ENABLED === "true";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
function required(name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
function bounded(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}
function log(level, event, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...details })}\n`,
  );
}
function headers(extra = {}) {
  return {
    ...serviceAuthHeaders,
    "Content-Type": "application/json",
    ...extra,
  };
}
async function rest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw Object.assign(new Error(`REST_${response.status}`), { code: `REST_${response.status}` });
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const normalized = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
function decrypt(value) {
  const raw = required("MAILBOX_CREDENTIALS_KEY");
  const key = Buffer.from(raw, "base64");
  const [version, iv, tag, encrypted] = String(value).split(".");
  if (key.length !== 32 || version !== "v1" || !iv || !tag || !encrypted)
    throw new Error("MAILBOX_CREDENTIAL_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
async function updateSyncState(boxes, changes) {
  const ids = boxes.map((box) => box.id).filter(Boolean);
  if (!ids.length) return;
  await rest(`corporate_mailboxes?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
  });
}
async function sync() {
  const managedSetup = env.STAFF_AUTOMATION_ENABLED === "true" || env.STAFF_MAIL_SETUP_ENABLED === "true";
  const mailboxes = (await rest(
    "corporate_mailboxes?active=eq.true&select=id,address,display_name,owner_user_id,last_synced_at,hosting_mode,imap_host,imap_port,imap_secure,imap_username,imap_password_ciphertext" +
      (managedSetup ? ",provisioning_create_only,managed_import_credential_id,provisioning_status" : ""),
  )).filter(importMailboxReady);
  if (!mailboxes.length) return;
  const corporateJunkEnabled = await corporateFoldersSupported(rest);
  const bookingAddresses = await rest(
    "trip_booking_mail_addresses?select=id,address,trip_uuid,mailbox_id,allowed_senders,retention_days,active",
  );
  const dedicated = mailboxes.filter((box) => box.imap_password_ciphertext);
  const fallback = mailboxes.filter((box) => !box.imap_password_ciphertext);
  const connections = dedicated.map((box) => ({
    boxes: [box],
    host: box.imap_host,
    hostingMode: box.hosting_mode,
    port: box.imap_port,
    secure: box.imap_secure,
    user: box.imap_username,
    password: () => decrypt(box.imap_password_ciphertext),
  }));
  if (fallback.length)
    connections.push({
      boxes: fallback,
      host: env.IMAP_HOST,
      port: bounded(env.IMAP_PORT, 993, 1, 65535),
      secure: env.IMAP_SECURE !== "false",
      user: env.IMAP_USER,
      password: () => required("IMAP_PASSWORD"),
    });
  let succeeded = 0;
  let failed = 0;
  for (const connection of connections) {
    let client;
    let phase = "configuration";
    try {
      const host =
        configuredMailboxImapHost(
          { hosting_mode: connection.hostingMode, imap_host: connection.host },
          env.IMAP_HOST,
        ) || required("IMAP_HOST");
      phase = "sync_state";
      await updateSyncState(connection.boxes, {
        sync_status: "syncing",
        last_sync_attempt_at: new Date().toISOString(),
        last_sync_error_code: null,
      });
      client = new ImapFlow({
        host,
        port: connection.port,
        secure: connection.secure,
        auth: { user: connection.user || required("IMAP_USER"), pass: connection.password() },
        logger: false,
        tls: configuredMailTls(
          host,
          env.IMAP_HOST,
          env.IMAP_TLS_SERVERNAME,
          env.IMAP_REJECT_UNAUTHORIZED !== "false",
        ),
      });
      client.on("error", (error) => {
        log("error", "imap.session_error", {
          mailboxIds: connection.boxes.map((box) => box.id),
          errorCode: safeImapErrorCode(error),
          phase,
        });
      });
      phase = "connect";
      await client.connect();
      try {
        {
          phase = "retention";
          await processMailCleanup({
            client,
            boxes: connection.boxes,
            rest,
            origin: supabaseUrl,
            authHeaders: serviceAuthHeaders,
            inbox: env.IMAP_MAILBOX?.trim() || "INBOX",
            schedule: env.CORPORATE_MAIL_RETENTION_ENABLED === "true",
            log,
          });
        }
        const importFolder = env.IMAP_MAILBOX?.trim() || "INBOX";
        const listedFolders = bookingMailEnabled || corporateJunkEnabled ? await client.list() : [];
        const junkFolders = [...new Set([...bookingJunkFolders(
          listedFolders,
          importFolder,
          connection.boxes,
          bookingAddresses || [],
          bookingMailEnabled,
        ), ...(corporateJunkEnabled ? corporateJunkFolders(listedFolders, importFolder) : [])])];
        const existingFolders = new Map();
        if (corporateJunkEnabled) {
          const existing = await rest(`corporate_mail_messages?mailbox_id=in.(${connection.boxes.map(box => box.id).join(",")})&direction=eq.inbound&select=mailbox_id,provider_message_id,mail_folder&order=received_at.desc&limit=1000`);
          for (const row of existing) existingFolders.set(`${row.mailbox_id}:${row.provider_message_id}`, row.mail_folder);
        }
        for (const folder of [...junkFolders, importFolder]) {
          const junkOnly = folder !== importFolder;
          phase = "mailbox_lock";
          const lock = await client.getMailboxLock(folder, { readOnly: junkOnly });
          try {
            phase = "search";
            const since = new Date(Date.now() - lookback * 86_400_000);
            const ids = await client.search({ since }, { uid: true });
            let recent = (ids || []).slice(-500);
            if (junkOnly && !corporateJunkEnabled && recent.length) {
              // Complete the header fetch before fetching bodies: no nested IMAP commands.
              const eligible = [];
              for await (const message of client.fetch(
                recent,
                { uid: true, headers: true, internalDate: true },
                { uid: true },
              )) {
                const parsed = await simpleParser(message.headers, { skipHtmlToText: true });
                if (
                  eligibleJunkBooking({
                    parsed,
                    receivedAt: message.internalDate,
                    mailboxes: connection.boxes,
                    addresses: bookingAddresses || [],
                    enabled: bookingMailEnabled,
                    inboxAddress: env.BOOKING_IMPORT_INBOX_ADDRESS || "info@globetrotr.nl",
                  })
                )
                  eligible.push(message.uid);
              }
              recent = eligible;
            }
            phase = "fetch_and_import";
            if (recent.length)
              for await (const message of client.fetch(
                recent,
                { uid: true, envelope: true, source: true, internalDate: true, flags: true },
                { uid: true },
              )) {
                const parsed = await simpleParser(message.source);
                const recipients = mailRecipients(parsed);
                const { bookingTargets, corporateTargets: routedCorporateTargets } =
                  routeBookingMail({
                    recipients,
                    mailboxes: connection.boxes,
                    addresses: bookingAddresses || [],
                    enabled: bookingMailEnabled,
                    inboxAddress: env.BOOKING_IMPORT_INBOX_ADDRESS || "info@globetrotr.nl",
                  });
                const corporateTargets = junkOnly && !corporateJunkEnabled ? [] : routedCorporateTargets;
                if (!corporateTargets.length && !bookingTargets.length) continue;
                const providerId = String(
                  parsed.messageId || (junkOnly ? `imap-folder:${Buffer.from(folder).toString("base64url")}:${client.mailbox.uidValidity}:${message.uid}` : `imap:${client.mailbox.uidValidity}:${message.uid}`),
                ).slice(0, 500);
                const bodyHtml = String(parsed.html || "")
                  .replace(/\0/g, "")
                  .slice(0, 100_000);
                const body = String(parsed.text || bodyHtml.replace(/<[^>]*>/g, " "))
                  .replace(/\0/g, "")
                  .slice(0, 100_000);
                const sender =
                  normalized(parsed.from?.value?.[0]?.address) || "unknown@globetrotr.nl";
                for (const bookingAddress of bookingTargets) {
                  if (junkOnly && !eligibleJunkBooking({ parsed, receivedAt: message.internalDate,
                    mailboxes: connection.boxes, addresses: bookingAddresses || [], enabled: bookingMailEnabled,
                    inboxAddress: env.BOOKING_IMPORT_INBOX_ADDRESS || "info@globetrotr.nl" })) continue;
                  const sourceExpiresAt = bookingSourceExpiry(bookingAddress, message.internalDate);
                  if (!sourceExpiresAt) continue;
                  const allowed = bookingAddress.allowed_senders || [];
                  const senderAllowed =
                    !allowed.length || allowed.some((value) => normalized(value) === sender);
                  if (!senderAllowed) {
                    log("info", "booking_mail.sender_rejected", {
                      addressId: bookingAddress.id,
                      senderDomain: sender.split("@")[1] || "unknown",
                    });
                    continue;
                  }
                  const recognized = parseBookingMail({ sender, subject: parsed.subject, body });
                  const fingerprint = createHash("sha256")
                    .update(`${providerId}\n${sender}\n${String(parsed.subject || "")}`)
                    .digest("hex");
                  for (const segment of bookingSegments(recognized, fingerprint)) {
                    try {
                      const bookingDraft = await storeBookingDraft({
                        rest,
                        record: {
                          address_id: bookingAddress.id,
                          trip_uuid: bookingAddress.trip_uuid,
                          message_id: null,
                          source_fingerprint: segment.fingerprint,
                          sender_address: sender,
                          subject: String(parsed.subject || "").slice(0, 500),
                          booking_type: segment.bookingType,
                          parsed_data: segment.parsedData,
                          confidence: segment.confidence,
                          source_expires_at: sourceExpiresAt,
                        },
                      });
                      if (bookingDraft?.length) {
                        const trips = await rest(
                          `trips?trip_uuid=eq.${bookingAddress.trip_uuid}&select=id,workspace_user_id`,
                        );
                        if (trips?.[0]?.workspace_user_id)
                          await rest("notifications", {
                            method: "POST",
                            headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
                            body: JSON.stringify({
                              user_id: trips[0].workspace_user_id,
                              kind: "trip_booking",
                              title: "Boekingsmail ontvangen / Booking email received",
                              body: `booking-mail|${recognized.bookingType}|${String(parsed.subject || "").slice(0, 160)}`,
                              event_key: `trip-booking-mail:${bookingDraft[0].id}`,
                              link: `/trips/${trips[0].id}`,
                            }),
                          });
                      }
                    } catch (error) {
                      if (error.code !== "REST_409") throw error;
                    }
                  }
                }
                const sourceFolder = junkOnly ? "junk" : "inbox";
                const pendingCorporateTargets = await pendingCorporateFolderImports(
                  corporateTargets, providerId, sourceFolder, existingFolders, rest, corporateJunkEnabled);
                if (!pendingCorporateTargets.length) continue;
                const safeAttachments = [];
                let blockedAttachmentCount = 0;
                let attachmentBytes = 0;
                for (const attachment of (parsed.attachments || []).slice(0, 5)) {
                  const content = Buffer.from(attachment.content || []);
                  attachmentBytes += content.length;
                  if (
                    !content.length ||
                    content.length > 10 * 1024 * 1024 ||
                    attachmentBytes > 20 * 1024 * 1024
                  )
                    continue;
                  try {
                    await scanBuffer(content);
                    safeAttachments.push({ attachment, content });
                  } catch (error) {
                    if (error?.code !== "MALWARE_DETECTED") throw error;
                    blockedAttachmentCount += 1;
                    log("error", "imap.attachment_rejected", {
                      errorCode: "MALWARE_DETECTED",
                    });
                  }
                }
                for (const box of pendingCorporateTargets) {
                  try {
                    const inserted = await rest(
                      "corporate_mail_messages?on_conflict=mailbox_id,provider_message_id",
                      {
                        method: "POST",
                        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
                        body: JSON.stringify({
                          mailbox_id: box.id,
                          provider_message_id: providerId,
                          thread_key:
                            String(
                              parsed.inReplyTo ||
                                parsed.references?.at(-1) ||
                                parsed.messageId ||
                                "",
                            ).slice(0, 500) || null,
                          direction: "inbound",
                          ...(corporateJunkEnabled ? { mail_folder: sourceFolder } : {}),
                          read_at: message.flags?.has("\\Seen") ? new Date().toISOString() : null,
                          sender_address: sender,
                          recipient_addresses: [...new Set(recipients)].slice(0, 50),
                          subject: String(parsed.subject || "").slice(0, 500),
                          preview_text:
                            `${blockedAttachmentCount ? `[${blockedAttachmentCount} bijlage(n) geblokkeerd / attachment(s) blocked] ` : ""}${body}`.slice(
                              0,
                              1000,
                            ),
                          body_text: body,
                          body_html: bodyHtml || null,
                          received_at: (
                            parsed.date ||
                            message.internalDate ||
                            new Date()
                          ).toISOString(),
                        }),
                      },
                    );
                    if (inserted?.length) {
                      existingFolders.set(`${box.id}:${providerId}`, sourceFolder);
                      for (const { attachment, content } of safeAttachments) {
                        const contentType = String(
                          attachment.contentType || "application/octet-stream",
                        ).slice(0, 150);
                        const fileName = String(attachment.filename || "attachment")
                          .replace(/[\0\r\n]/g, "")
                          .slice(0, 255);
                        const extension = fileName.includes(".")
                          ? `.${fileName
                              .split(".")
                              .pop()
                              .replace(/[^a-z0-9]/gi, "")
                              .slice(0, 10)}`
                          : "";
                        const storageKey = `${box.id}/inbound/${randomUUID()}${extension}`;
                        const encodedPath = storageKey.split("/").map(encodeURIComponent).join("/");
                        const upload = await fetch(
                          `${supabaseUrl}/storage/v1/object/corporate-mail/${encodedPath}`,
                          {
                            method: "POST",
                            headers: {
                              ...serviceAuthHeaders,
                              "Content-Type": contentType,
                              "x-upsert": "false",
                            },
                            body: content,
                          },
                        );
                        if (!upload.ok) {
                          log("error", "imap.attachment_upload_failed", {
                            mailboxId: box.id,
                            status: upload.status,
                          });
                          continue;
                        }
                        try {
                          await rest("corporate_mail_attachments", {
                            method: "POST",
                            headers: { Prefer: "return=minimal" },
                            body: JSON.stringify({
                              message_id: inserted[0].id,
                              storage_key: storageKey,
                              file_name: fileName || "attachment",
                              content_type: contentType,
                              size_bytes: content.length,
                              sha256: createHash("sha256").update(content).digest("hex"),
                              content_id:
                                String(attachment.contentId || "")
                                  .replace(/^<|>$/g, "")
                                  .slice(0, 255) || null,
                            }),
                          });
                        } catch (error) {
                          log("error", "imap.attachment_record_failed", {
                            mailboxId: box.id,
                            errorCode: String(error?.code || "ATTACHMENT_RECORD_FAILED").slice(
                              0,
                              80,
                            ),
                          });
                        }
                      }
                      const members = await rest(
                        `corporate_mailbox_members?mailbox_id=eq.${box.id}&select=user_id`,
                      );
                      const users = [
                        ...new Set(
                          [box.owner_user_id, ...(members ?? []).map((row) => row.user_id)].filter(
                            Boolean,
                          ),
                        ),
                      ];
                      if (users.length) {
                        await rest("notifications", {
                          method: "POST",
                          headers: { Prefer: "return=minimal" },
                          body: JSON.stringify(
                            users.map((userId) => ({
                              user_id: userId,
                              kind: "account",
                              title: "Nieuwe bedrijfsmail / New company email",
                              body: `mail|${box.display_name}|${String(parsed.subject || "").slice(0, 160)}`,
                              event_key: `corporate-mail:${inserted[0].id}`,
                              link: "/company-mail",
                            })),
                          ),
                        });
                      }
                    }
                  } catch (error) {
                    if (error.code !== "REST_409") throw error;
                  }
                }
              }
          } finally {
            lock.release();
          }
        }
      } catch (error) {
        // Preserve the original error and phase; cleanup must not mask them.
        client.close();
        throw error;
      }
      phase = "logout";
      await client.logout();
      phase = "sync_state";
      await updateSyncState(connection.boxes, {
        sync_status: "ready",
        last_synced_at: new Date().toISOString(),
        last_sync_error_code: null,
        sync_requested_at: null,
      });
      succeeded += connection.boxes.length;
    } catch (error) {
      failed += connection.boxes.length;
      const errorCode = safeImapErrorCode(error);
      await updateSyncState(connection.boxes, {
        sync_status: "error",
        last_sync_error_code: errorCode,
        sync_requested_at: null,
      });
      log("error", "imap.connection_failed", {
        mailboxIds: connection.boxes.map((box) => box.id),
        errorCode,
        phase,
      });
    } finally {
      // A failed connect must not leave its socket alive between sync rounds.
      client?.close();
    }
  }
  log(failed ? "error" : "info", "imap.synced", { succeeded, failed });
}
while (!stopping) {
  try {
    await sync();
  } catch (error) {
    log("error", "imap.sync_failed", {
      errorCode: safeImapErrorCode(error),
    });
  }
  await new Promise((resolve) => setTimeout(resolve, interval));
}
