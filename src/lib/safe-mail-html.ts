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
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .split(/(<[^>]*>)/g)
    .map((token) => {
      if (!token.startsWith("<")) return token;
      const closing = token.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i);
      if (closing) {
        const tag = closing[1].toLowerCase();
        if (tag === "div") return "</p>";
        return allowedSimpleTags.has(tag) || tag === "a" ? `</${tag}>` : "";
      }
      const opening = token.match(/^<\s*([a-z0-9]+)([\s\S]*?)>$/i);
      if (!opening) return "";
      const tag = opening[1].toLowerCase();
      // contentEditable uses divs for new paragraphs in several browsers.
      // Store those as the safe paragraph element supported by the mail editor.
      if (tag === "div") return "<p>";
      if (allowedSimpleTags.has(tag)) return tag === "br" ? "<br>" : `<${tag}>`;
      if (tag !== "a") return "";
      const hrefMatch = opening[2].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeHref(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "");
      return href
        ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">`
        : "<a>";
    })
    .join("")
    .trim();
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
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;border-top:1px solid #dfe9e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"><tr><td style="padding-top:20px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="62" valign="top" style="padding-right:14px"><img src="https://globetrotr.nl/assets/email/logo.png" width="52" height="52" alt="GlobeTrotr" style="display:block;border:0;border-radius:14px"></td><td valign="top"><div style="font-size:16px;line-height:22px;font-weight:700;color:#102039">${name}</div>${details ? `<div style="margin-top:2px;font-size:13px;line-height:19px;color:#5f6f78">${details}</div>` : ""}<div style="margin-top:7px;font-size:13px;line-height:19px;font-weight:700;color:#168b78">GlobeTrotr</div><div style="font-size:12px;line-height:18px;color:#748078">Plan every trip. Track every euro.</div><div style="margin-top:8px;font-size:12px;line-height:19px"><a href="mailto:${address}" style="color:#36515b;text-decoration:none">${address}</a><span style="color:#b2bfba"> &nbsp;·&nbsp; </span><a href="https://globetrotr.nl" style="color:#168b78;text-decoration:none;font-weight:600">globetrotr.nl</a></div><div style="margin-top:10px;font-size:12px"><a href="https://globetrotr.nl/contact" style="color:#526a72;text-decoration:underline">Contact</a></div></td></tr></table></td></tr></table>`;
}

export function corporateSignatureText(input: { signatureText: string; displayName: string; address: string }) {
  const details = personalSignatureLines(input.signatureText, input.displayName);
  return [
    input.displayName.trim() || "GlobeTrotr",
    ...details,
    "GlobeTrotr",
    "Plan every trip. Track every euro.",
    input.address.trim(),
    "https://globetrotr.nl",
    "Contact: https://globetrotr.nl/contact",
  ].filter(Boolean).join("\n");
}
