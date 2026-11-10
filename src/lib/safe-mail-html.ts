import { Parser } from "htmlparser2";
import { GLOBETROTR_SLOGAN } from "./branding.ts";

const allowedSimpleTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li"]);

function safeHref(value: string) {
  const decoded = value.replace(/&amp;/gi, "&").trim();
  return /^(https?:|mailto:)/i.test(decoded) ? decoded : "";
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Keeps only the formatting subset offered by the company-mail editor. */
export function sanitizeMailHtml(input: string) {
  const output: string[] = [];
  const stack: string[] = [];
  let suppressed = 0;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "script" || name === "style") { suppressed++; return; }
      if (suppressed) return;
      const tag = name === "div" ? "p" : name;
      if (!allowedSimpleTags.has(tag) && tag !== "a") return;
      if (tag === "a") {
        const href = safeHref(attributes.href ?? "");
        output.push(href ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">` : "<a>");
      } else output.push(`<${tag}>`);
      if (tag !== "br") stack.push(tag);
    },
    ontext(text) { if (!suppressed) output.push(escapeAttribute(text)); },
    onclosetag(name) {
      if (name === "script" || name === "style") { suppressed = Math.max(0, suppressed - 1); return; }
      if (suppressed) return;
      const tag = name === "div" ? "p" : name;
      const index = stack.lastIndexOf(tag);
      if (index < 0) return;
      while (stack.length > index) output.push(`</${stack.pop()}>`);
    },
  }, { decodeEntities: true });
  parser.end(input);
  while (stack.length) output.push(`</${stack.pop()}>`);
  return output.join("").trim();
}

export function plainTextToMailHtml(input: string) {
  const escaped = input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

/** Repairs drafts saved before browser paragraph blocks were preserved. */
export function composedMailHtml(inputHtml: string, inputText: string) {
  const sanitized = sanitizeMailHtml(inputHtml);
  if (/\r?\n/.test(inputText) && !/<(?:p|br|ul|ol|li)\b/i.test(sanitized)) {
    return plainTextToMailHtml(inputText.replace(/\r\n?/g, "\n"));
  }
  return sanitized;
}

/** Restores HTML that an IMAP provider returned as one fully escaped document. */
export function mailHtmlForDisplay(bodyHtml?: string | null, bodyText?: string | null) {
  const html = String(bodyHtml || "").trim();
  if (/<(?:!doctype|html|body|head|table|div|p|br|style)\b/i.test(html)) return html;
  if (/&lt;(?:!doctype|html|body|head|table|div|p|br|style)\b/i.test(html)) {
    return html
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'")
      .replace(/&amp;/gi, "&");
  }
  return plainTextToMailHtml(html || String(bodyText || ""));
}

const signatureBoilerplate = [
  /^globetrotr$/i,
  /^Your whole trip, planned together in one place\.$/i,
  /^Jullie hele rondreis, samen geregeld op één plek\.$/i,
  /^plan every trip\. track every euro\.$/i,
  /^plan je reis \/ plan your trip:/i,
  /^contact:/i,
  /^https:\/\/globetrotr\.nl\/?$/i,
];

function personalSignatureLines(signatureText: string, displayName: string) {
  return signatureText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLocaleLowerCase() !== displayName.trim().toLocaleLowerCase())
    .filter((line) => !signatureBoilerplate.some((pattern) => pattern.test(line)))
    .slice(0, 6);
}

/** Renders the trusted GlobeTrotr frame while treating every mailbox value as plain text. */
export function corporateSignatureHtml(input: { signatureText: string; displayName: string; address: string }) {
  const name = escapeAttribute(input.displayName.trim() || "GlobeTrotr");
  const address = escapeAttribute(input.address.trim());
  const details = personalSignatureLines(input.signatureText, input.displayName)
    .map((line) => escapeAttribute(line))
    .join("<br>");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;border-top:1px solid #dfe9e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"><tr><td style="padding-top:20px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="62" valign="top" style="padding-right:14px"><img src="https://globetrotr.nl/assets/email/logo.png?v=20261019" width="52" height="52" alt="GlobeTrotr" style="display:block;border:0;border-radius:14px"></td><td valign="top"><div style="font-size:16px;line-height:22px;font-weight:700;color:#102039">${name}</div>${details ? `<div style="margin-top:2px;font-size:13px;line-height:19px;color:#5f6f78">${details}</div>` : ""}<div style="margin-top:7px;font-size:13px;line-height:19px;font-weight:700;color:#117A65">GlobeTrotr</div><div style="font-size:12px;line-height:18px;color:#748078">${GLOBETROTR_SLOGAN.en}</div><div style="margin-top:8px;font-size:12px;line-height:19px"><a href="mailto:${address}" style="color:#36515b;text-decoration:none">${address}</a><span style="color:#b2bfba"> &nbsp;·&nbsp; </span><a href="https://globetrotr.nl" style="color:#117A65;text-decoration:none;font-weight:600">globetrotr.nl</a></div><div style="margin-top:10px;font-size:12px"><a href="https://globetrotr.nl/contact" style="color:#526a72;text-decoration:underline">Contact</a></div></td></tr></table></td></tr></table>`;
}

export function corporateSignatureText(input: { signatureText: string; displayName: string; address: string }) {
  const details = personalSignatureLines(input.signatureText, input.displayName);
  return [
    input.displayName.trim() || "GlobeTrotr",
    ...details,
    "GlobeTrotr",
    GLOBETROTR_SLOGAN.en,
    input.address.trim(),
    "https://globetrotr.nl",
    "Contact: https://globetrotr.nl/contact",
  ].filter(Boolean).join("\n");
}
