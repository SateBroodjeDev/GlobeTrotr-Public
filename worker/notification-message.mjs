import { mailLocale } from "./mail-locale.mjs";
import { notificationCopy } from "./notification-copy.mjs";
import { emailBranding, emailPreferenceFooter } from "./email-branding.mjs";

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
export function notificationMessage(body) {
  body = { ...body, locale: mailLocale(body.locale) };
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const copy = notificationCopy(body);
  const subject = copy.subject;
  const text = copy.body;
  const brand = emailBranding(payload, body.locale);
  const formattedBody = text
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:25px;color:#52606b">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const brandingHost = String(payload.branding?.portalHost || "").toLowerCase();
  let actionUrl = "https://portal.globetrotr.nl/dashboard";
  let secondaryActionUrl = null;
  try {
    const candidate = new URL(copy.actionUrl);
    if (
      candidate.protocol === "https:" &&
      (["globetrotr.nl", "portal.globetrotr.nl"].includes(candidate.hostname) ||
        candidate.hostname === brandingHost)
    )
      actionUrl = candidate.toString();
  } catch {}
  try {
    const candidate = new URL(payload.secondaryActionUrl);
    if (
      candidate.protocol === "https:" &&
      (["globetrotr.nl", "portal.globetrotr.nl"].includes(candidate.hostname) ||
        candidate.hostname === brandingHost)
    ) secondaryActionUrl = candidate.toString();
  } catch {}
  const secondaryActionLabel = String(payload.secondaryActionLabel || "").trim().slice(0, 100);
  const preferenceFooter = emailPreferenceFooter(body.templateKey, body.locale, brandingHost);
  const preferenceLink = preferenceFooter.url
    ? `<a href="${escapeHtml(preferenceFooter.url)}" style="color:#77827c">${escapeHtml(preferenceFooter.label)}</a>`
    : "";
  const actionLabel =
    body.templateKey === "auth"
      ? payload.authAction === "staff_notice" ? "Teamlogin"
        : payload.authAction === "recovery" ? body.locale === "en" ? "Choose a new password" : "Nieuw wachtwoord kiezen"
        : body.locale === "en" ? "Continue securely" : "Veilig verdergaan"
    : body.templateKey === "public_trip_follow"
      ? body.locale === "en" ? "Confirm following" : "Volgen bevestigen"
      : body.templateKey === "public_trip_update"
        ? body.locale === "en" ? "View travel update" : "Reisupdate bekijken"
    : body.templateKey === "invitation"
      ? body.locale === "en"
        ? "View invitation"
        : "Uitnodiging bekijken"
      : body.templateKey === "billing"
        ? body.locale === "en"
          ? "View subscription and invoice"
          : "Abonnement en factuur bekijken"
        : body.locale === "en"
          ? `Open ${brand.name}`
          : `${brand.name} openen`;
  const headerLogo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="56" height="56" alt="${escapeHtml(brand.name)}" style="display:block;max-width:180px;object-fit:contain">`
    : "";
  const tagline = brand.tagline
    ? `<div style="margin-top:5px;font-size:13px;color:#748078">${escapeHtml(brand.tagline)}</div>`
    : "";
  const contact = brand.agency
    ? brand.contactEmail
      ? `<p style="margin:24px 0 0;font-size:13px;color:#77827c"><a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:${brand.accent};text-decoration:none;font-weight:600">${escapeHtml(body.locale === "en" ? `Contact ${brand.name}` : `Contact met ${brand.name}`)}</a></p>`
      : ""
    : `<p style="margin:24px 0 0;font-size:13px;color:#77827c"><a href="https://globetrotr.nl/contact" style="color:${brand.accent};text-decoration:none;font-weight:600">${body.locale === "en" ? "Contact GlobeTrotr" : "Contact met GlobeTrotr"}</a></p>`;
  return {
    subject,
    text: `${subject}\n\n${text}\n\n${actionUrl}${secondaryActionUrl && secondaryActionLabel ? `\n\n${secondaryActionLabel}: ${secondaryActionUrl}` : ""}\n\n${preferenceFooter.note}${preferenceFooter.url ? `\n${preferenceFooter.url}` : ""}\n\n${brand.serviceNote}`,
    html: `<!doctype html><html lang="${body.locale === "en" ? "en" : "nl"}"><body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#102039"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e4ebe8;border-radius:18px;overflow:hidden"><tr><td align="center" style="padding:36px 40px 24px">${headerLogo}<div style="margin-top:${headerLogo ? "13px" : "0"};font-size:22px;font-weight:700">${escapeHtml(brand.name)}</div>${tagline}</td></tr><tr><td style="padding:36px 40px 40px;border-top:1px solid #edf1ef">${copy.severity === "critical" ? `<p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#a12a2a">${body.locale === "en" ? "Critical service incident" : "Kritieke storing"}</p>` : ""}<h1 style="margin:0 0 18px;font-size:27px">${escapeHtml(subject)}</h1>${formattedBody}<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="${brand.accent}" style="border-radius:10px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 26px;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(actionLabel)}</a></td></tr></table>${secondaryActionUrl && secondaryActionLabel ? `<p style="margin:20px 0 0;font-size:12px"><a href="${escapeHtml(secondaryActionUrl)}" style="color:#77827c">${escapeHtml(secondaryActionLabel)}</a></p>` : ""}${contact}</td></tr><tr><td align="center" style="padding:24px;background:#fafcfb;border-top:1px solid #edf1ef;font-size:11px;color:#77827c"><p style="margin:0 0 8px">${escapeHtml(preferenceFooter.note)}</p>${preferenceLink ? `<p style="margin:0 0 8px">${preferenceLink}</p>` : ""}<p style="margin:0">${escapeHtml(brand.name)}</p></td></tr></table></td></tr></table></body></html>`,
  };
}
