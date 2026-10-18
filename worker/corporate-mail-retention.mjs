// Source first, objects second, application records last. Failed steps remain retryable.
export async function removeMailSource(client, job, mailboxAddress, inbox = "INBOX") {
  if (!client.capabilities.has("UIDPLUS")) throw new Error("RETENTION_UIDPLUS_REQUIRED");
  const id = job.provider_message_id;
  const scoped = /^imap-folder:([a-zA-Z0-9_-]+):(\d+):(\d+)$/.exec(id);
  const sourceFolder = scoped ? Buffer.from(scoped[1], "base64url").toString("utf8") : inbox;
  if (scoped && (!sourceFolder || /[\r\n\0]/.test(sourceFolder))) throw new Error("RETENTION_SOURCE_ID_INVALID");
  const legacy = scoped ? [id, scoped[2], scoped[3]] : /^imap:(\d+):(\d+)$/.exec(id);
  const outbox = /^outbox:([0-9a-f-]{36})$/i.exec(id);
  const messageId = outbox ? `<${outbox[1]}@${mailboxAddress.split("@")[1]}>` : id;
  if (!legacy && (!messageId || /[\r\n\0]/.test(messageId))) throw new Error("RETENTION_SOURCE_ID_INVALID");
  const folders = (await client.list()).filter(folder => !folder.flags?.has("\\Noselect"));
  if (!folders.length) throw new Error("RETENTION_FOLDER_LIST_EMPTY");
  let legacyChecked = false;
  for (const folder of folders) {
    if (legacy && folder.path !== sourceFolder) continue;
    const lock = await client.getMailboxLock(folder.path);
    try {
      if (legacy) {
        if (String(client.mailbox.uidValidity) !== legacy[1]) throw new Error("RETENTION_UIDVALIDITY_CHANGED");
        legacyChecked = true;
      }
      const matches = legacy ? [Number(legacy[2])] : await client.search({ header: { "message-id": messageId } }, { uid: true });
      if (!Array.isArray(matches)) throw new Error("RETENTION_SEARCH_FAILED");
      const exact = [];
      // Fetch only envelope metadata; never issue IMAP commands inside a fetch iterator.
      if (matches.length) for await (const message of client.fetch(matches, { uid: true, envelope: true }, { uid: true })) {
        if (legacy || message.envelope?.messageId === messageId) exact.push(message.uid);
      }
      if (exact.length && !(await client.messageDelete(exact, { uid: true }))) throw new Error("RETENTION_SOURCE_DELETE_FAILED");
    } finally { lock.release(); }
  }
  if (legacy && !legacyChecked) throw new Error("RETENTION_SOURCE_FOLDER_MISSING");
}

export async function processMailCleanup({ client, boxes, rest, request = fetch, origin, authHeaders, inbox, schedule = false, log }) {
  const rpc = (name, data) => rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(data) });
  const jobs = await rpc("claim_corporate_mail_cleanup", { p_mailboxes: boxes.map(box => box.id), p_schedule: schedule });
  for (const job of jobs || []) {
    try {
      const box = boxes.find(box => box.id === job.mailbox_id);
      if (!box) throw new Error("RETENTION_MAILBOX_MISMATCH");
      for (const key of job.storage_keys || []) {
        if (!key.startsWith(`${box.id}/`) || key.split("/").some(part => !part || part === "." || part === "..")) throw new Error("RETENTION_OBJECT_PATH_INVALID");
      }
      await removeMailSource(client, job, box.address, inbox);
      if (job.storage_keys?.length) {
        const removed = await request(`${origin}/storage/v1/object/corporate-mail`, {
          method: "DELETE", headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: job.storage_keys }), signal: AbortSignal.timeout(20000),
        });
        if (!removed.ok) throw new Error("RETENTION_OBJECT_DELETE_FAILED");
        for (const key of job.storage_keys) {
          const path = key.split("/").map(encodeURIComponent).join("/");
          const check = await request(`${origin}/storage/v1/object/info/corporate-mail/${path}`, {
            method: "GET", headers: authHeaders, signal: AbortSignal.timeout(20000),
          });
          // Some Storage versions wrap object-not-found (404) in an HTTP 400 response.
          const error = check.status === 400 ? await check.json().catch(() => null) : null;
          const absent = check.status === 404 || (check.status === 400 && String(error?.statusCode) === "404" && error?.message === "Object not found");
          if (!absent) throw new Error("RETENTION_OBJECT_REMOVAL_UNCONFIRMED");
        }
      }
      await rpc("finish_corporate_mail_cleanup", { p_job: job.id, p_token: job.token });
      log("info", "corporate_mail.retention_deleted", { jobId: job.id });
    } catch (error) {
      log("error", "corporate_mail.retention_failed", { jobId: job.id, code: /^RETENTION_[A-Z_]+$/.test(error.message) ? error.message : "RETENTION_FAILED" });
    }
  }
}
