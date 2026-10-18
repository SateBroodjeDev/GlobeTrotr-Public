export function safeImapErrorCode(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toUpperCase();
  if (code.startsWith("MALWARE_")) return code.slice(0, 80);
  if (/AUTH|LOGIN|CREDENTIAL/.test(`${code} ${message}`)) return "IMAP_AUTH_FAILED";
  if (/CERT|TLS|SSL/.test(`${code} ${message}`)) return "IMAP_TLS_FAILED";
  if (/TIMEOUT|TIMEDOUT/.test(`${code} ${message}`)) return "IMAP_TIMEOUT";
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|NETWORK/.test(code)) return "IMAP_UNREACHABLE";
  if (/^REST_[0-9]{3}$/.test(code)) return "IMAP_STORAGE_ERROR";
  return "IMAP_SYNC_FAILED";
}
