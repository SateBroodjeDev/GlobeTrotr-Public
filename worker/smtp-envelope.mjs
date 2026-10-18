export function platformSmtpEnvelope(authenticatedUser, recipients) {
  const from = String(authenticatedUser || "").trim().toLowerCase();
  const to = [...new Set((recipients || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
  if (!from || !to.length) throw new Error("INVALID_SMTP_ENVELOPE");
  return { from, to };
}
