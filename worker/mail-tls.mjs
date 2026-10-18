// Connections to an internal Compose hostname can verify the server's real
// certificate name without disabling CA or hostname verification.
export function configuredMailboxImapHost(mailbox, internalHost) {
  if (mailbox.hosting_mode !== "self_hosted") return mailbox.imap_host;
  const host = String(internalHost || "").trim();
  if (!host) throw Object.assign(new Error("IMAP_HOST_MISSING"), { code: "IMAP_HOST_MISSING" });
  return host;
}

export function configuredMailTls(host, configuredHost, servername, rejectUnauthorized = true) {
  const expected = String(servername || "").trim().toLowerCase();
  if (expected && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(expected)) {
    throw Object.assign(new Error("MAIL_TLS_SERVERNAME_INVALID"), { code: "MAIL_TLS_SERVERNAME_INVALID" });
  }
  return {
    rejectUnauthorized,
    ...(expected && host === configuredHost ? { servername: expected } : {}),
  };
}
