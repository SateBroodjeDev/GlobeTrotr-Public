function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
function formatCorporateBodyHtml(value) {
  return String(value)
    .replace(/<p>/gi, '<p style="margin:0 0 16px">')
    .replace(/<ul>/gi, '<ul style="margin:0 0 16px;padding-left:24px">')
    .replace(/<ol>/gi, '<ol style="margin:0 0 16px;padding-left:24px">');
}
export function corporateMessage(body) {
  const subject = body.subject.trim().slice(0, 160);
  const text = body.text.trim().slice(0, 20_000);
  const messageHtml =
    typeof body.html === "string" && body.html.trim()
      ? formatCorporateBodyHtml(body.html.trim().slice(0, 100_000))
      : text
          .split(/\n{2,}/)
          .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
          .join("");
  return {
    subject,
    text,
    html: `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#102039"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e4ebe8;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 36px;border-bottom:1px solid #edf1ef"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="48" style="vertical-align:middle"><img src="https://globetrotr.nl/assets/email/logo.png" width="48" height="48" alt="" style="display:block;border:0"></td><td style="padding-left:14px;vertical-align:middle;font-family:Arial,sans-serif;font-size:28px;font-weight:700;line-height:34px;color:#123e40">GlobeTrotr</td></tr></table></td></tr><tr><td style="padding:32px 36px"><h1 style="margin:0 0 22px;font-size:24px">${escapeHtml(subject)}</h1><div style="font-size:16px;line-height:25px;color:#3d4d58">${messageHtml}</div></td></tr></table></td></tr></table></body></html>`,
  };
}
