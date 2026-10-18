import { corporateMessage } from "./corporate-message.mjs";
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import nodemailer from "nodemailer";
import { notificationMessage } from "./notification-message.mjs";
import { validateAgencySmtp } from "./agency-smtp.mjs";
import { platformSmtpEnvelope } from "./smtp-envelope.mjs";
import { publicSmtpConnection } from "./public-network.mjs";
import { configuredMailTls } from "./mail-tls.mjs";

const env = process.env;
const token = required("MAIL_RELAY_TOKEN");
const port = bounded(env.MAIL_RELAY_PORT, 9092, 1, 65535);
const smtpUser = required("SMTP_USER").toLowerCase();
const defaultAddress = required("SMTP_FROM_ADDRESS").toLowerCase();
const defaultName = (env.SMTP_FROM_NAME || "GlobeTrotr").trim().slice(0, 100);
const allowedDomains = new Set(
  (env.SMTP_ALLOWED_FROM_DOMAINS || "globetrotr.nl")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
);
const transporter = nodemailer.createTransport({
  host: required("SMTP_HOST"),
  port: bounded(env.SMTP_PORT, 587, 1, 65535),
  secure: env.SMTP_SECURE === "true",
  requireTLS: env.SMTP_REQUIRE_TLS !== "false",
  tls: configuredMailTls(env.SMTP_HOST, env.SMTP_HOST, env.SMTP_TLS_SERVERNAME),
  auth: { user: smtpUser, pass: required("SMTP_PASSWORD") },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  disableFileAccess: true,
  disableUrlAccess: true,
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
function equalSecret(value) {
  const a = Buffer.from(value || "");
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validEmail(value) {
  return (
    typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
function addresses(value, maximum = 25) {
  const list = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (!list.length || list.length > maximum || !list.every(validEmail))
    throw code("INVALID_RECIPIENTS");
  return [...new Set(list.map((v) => v.toLowerCase()))];
}
function code(message) {
  return Object.assign(new Error(message), { code: message });
}
function safeFrom(input, exactAddress) {
  const address = input?.address ? String(input.address).trim().toLowerCase() : defaultAddress;
  const domain = address.split("@")[1];
  if (
    !validEmail(address) ||
    (exactAddress ? address !== exactAddress : !allowedDomains.has(domain))
  )
    throw code("INVALID_SENDER");
  return {
    address,
    name: String(input?.name || defaultName)
      .trim()
      .slice(0, 100),
  };
}
async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 30 * 1024 * 1024) throw code("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw code("INVALID_JSON");
  }
}
async function send(body, idempotencyKey) {
  if (
    !body ||
    typeof body !== "object" ||
    !/^[0-9a-f-]{36}$/i.test(String(body.id || "")) ||
    idempotencyKey !== body.id
  )
    throw code("INVALID_MESSAGE_ID");
  const corporate = typeof body.subject === "string" && typeof body.text === "string";
  const content = corporate ? corporateMessage(body) : notificationMessage(body);
  if (!content.subject || !content.text) throw code("INVALID_CONTENT");
  const attachments = corporate && Array.isArray(body.attachments) ? body.attachments : [];
  let attachmentBytes = 0;
  const safeAttachments = attachments.map((attachment) => {
    if (
      typeof attachment?.filename !== "string" ||
      !attachment.filename.trim() ||
      attachment.filename.length > 255 ||
      typeof attachment?.contentType !== "string" ||
      attachment.contentType.length > 150 ||
      typeof attachment?.content !== "string"
    )
      throw code("INVALID_ATTACHMENT");
    const content = Buffer.from(attachment.content, "base64");
    attachmentBytes += content.length;
    if (
      content.length < 1 ||
      content.length > 10 * 1024 * 1024 ||
      attachmentBytes > 20 * 1024 * 1024
    )
      throw code("INVALID_ATTACHMENT");
    return { filename: attachment.filename, contentType: attachment.contentType, content };
  });
  if (safeAttachments.length > 5) throw code("INVALID_ATTACHMENT");
  const agencySmtp = validateAgencySmtp(body.smtp);
  const selectedTransport = agencySmtp
    ? nodemailer.createTransport({
        ...await publicSmtpConnection(agencySmtp.host),
        port: agencySmtp.port,
        secure: agencySmtp.secure,
        requireTLS: !agencySmtp.secure,
        auth: { user: agencySmtp.username, pass: agencySmtp.password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
    : transporter;
  const sender = agencySmtp
    ? safeFrom({ address: agencySmtp.fromEmail, name: agencySmtp.fromName }, agencySmtp.fromEmail)
    : safeFrom(corporate ? body.from : undefined);
  const to = addresses(body.to);
  const cc = body.cc?.length ? addresses(body.cc) : undefined;
  await selectedTransport.sendMail({
    from: sender,
    replyTo: agencySmtp?.replyTo,
    to,
    cc,
    envelope: agencySmtp ? undefined : platformSmtpEnvelope(smtpUser, [...to, ...(cc || [])]),
    subject: content.subject,
    text: content.text,
    html: content.html,
    inReplyTo:
      corporate && typeof body.inReplyTo === "string" ? body.inReplyTo.slice(0, 500) : undefined,
    references:
      corporate && typeof body.references === "string" ? body.references.slice(0, 500) : undefined,
    messageId: `<${body.id}@${sender.address.split("@")[1]}>`,
    headers: agencySmtp
      ? { "X-Delivery-Message-ID": body.id }
      : { "X-GlobeTrotr-Message-ID": body.id },
    attachments: safeAttachments,
  });
}

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET" && request.url === "/health") {
    try {
      await transporter.verify();
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"status":"ok","smtp":"reachable"}');
    } catch {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end('{"status":"degraded","smtp":"unreachable"}');
    }
    return;
  }
  if (request.method !== "POST" || request.url !== "/send") {
    response.writeHead(404).end();
    return;
  }
  if (!equalSecret(String(request.headers.authorization || "").replace(/^Bearer\s+/i, ""))) {
    response.writeHead(401).end();
    return;
  }
  try {
    await send(await readJson(request), String(request.headers["idempotency-key"] || ""));
    response.writeHead(202).end();
  } catch (error) {
    const errorCode = String(error?.code || "MAIL_SEND_FAILED").slice(0, 80);
    const smtpResponseCode = Number.isInteger(error?.responseCode) ? error.responseCode : undefined;
    const smtpCommand = typeof error?.command === "string" ? error.command.slice(0, 40) : undefined;
    process.stderr.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "relay.send_failed", errorCode, smtpResponseCode, smtpCommand })}\n`,
    );
    response.writeHead(
      errorCode.startsWith("INVALID_") || errorCode === "BODY_TOO_LARGE" ? 400 : 502,
      { "Content-Type": "application/json" },
    );
    response.end(JSON.stringify({ error: errorCode, smtpResponseCode }));
  }
});

server.listen(port, "0.0.0.0", async () => {
  try {
    await transporter.verify();
    process.stdout.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), level: "info", event: "relay.started", port, smtpVerified: true })}\n`,
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "relay.smtp_unavailable", errorCode: "SMTP_VERIFY_FAILED" })}\n`,
    );
  }
});
