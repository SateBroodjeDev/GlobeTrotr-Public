function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateAgencySmtp(value) {
  if (value == null) return null;
  const host = String(value.host || "").trim().toLowerCase(), port = Number(value.port);
  const username = String(value.username || "").trim(), password = String(value.password || "");
  const fromEmail = String(value.fromEmail || "").trim().toLowerCase();
  if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(host) || /^(?:localhost|.*\.local)$/i.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !username || username.length > 254 || !password || password.length > 1024 || !validEmail(fromEmail))
    throw Object.assign(new Error("INVALID_AGENCY_SMTP"), { code: "INVALID_AGENCY_SMTP" });
  return { host, port, secure: Boolean(value.secure), username, password, fromEmail, fromName: String(value.fromName || "").trim().slice(0, 100), replyTo: validEmail(value.replyTo) ? value.replyTo : undefined };
}
