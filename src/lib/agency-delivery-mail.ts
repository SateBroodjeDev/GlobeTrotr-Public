type MailInput = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
};
type Defaults = { system_name?: string; sender_name?: string; contact_email?: string };
const email = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function agencySmtpDisplayPort(value: unknown) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 587;
}

export function prepareAgencyDeliveryMail(
  input: MailInput,
  defaults: Defaults,
  passwordSet: boolean,
) {
  const host = input.smtpHost?.trim().toLowerCase() ?? "";
  const username = input.smtpUsername?.trim() ?? "";
  const password = input.smtpPassword ?? "";
  const custom = Boolean(host || username || password);
  const fromName =
    input.fromName.trim() || defaults.sender_name?.trim() || defaults.system_name?.trim() || "";
  const fromEmail = (
    input.fromEmail.trim() ||
    (!custom ? defaults.contact_email?.trim() : "") ||
    ""
  ).toLowerCase();
  const replyTo = input.replyTo.trim().toLowerCase();
  if (!fromName || fromName.length > 60) throw new Error("INVALID_MAIL_FROM_NAME");
  if (!email(fromEmail)) throw new Error("INVALID_MAIL_FROM_EMAIL");
  if (replyTo && !email(replyTo)) throw new Error("INVALID_MAIL_REPLY_TO");
  const mail = { fromName, fromEmail, replyTo };
  if (!custom) return { mail, smtp: null };
  if (
    !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(host) ||
    /^(?:localhost|.*\.local)$/i.test(host)
  )
    throw new Error("INVALID_SMTP_HOST");
  const port = Number(input.smtpPort ?? 587);
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !username ||
    username.length > 254 ||
    password.length > 1024
  )
    throw new Error("INVALID_SMTP_SETTINGS");
  if (!password && !passwordSet) throw new Error("SMTP_PASSWORD_REQUIRED");
  return { mail, smtp: { host, port, username, password, secure: Boolean(input.smtpSecure) } };
}

export function agencyDeliveryErrorMessage(
  error: unknown,
  text: (nl: string, en: string) => string,
) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "INVALID_MAIL_FROM_NAME":
      return text(
        "Vul een afzendernaam in bij je organisatiegegevens.",
        "Enter a sender name in your organisation details.",
      );
    case "INVALID_MAIL_FROM_EMAIL":
      return text(
        "Vul een geldig afzenderadres in, of een contactadres bij je organisatiegegevens als je de centrale relay gebruikt.",
        "Enter a valid from address, or a contact email in your organisation details when using the central relay.",
      );
    case "INVALID_MAIL_REPLY_TO":
      return text(
        "Vul een geldig reply-to-adres in of laat dit veld leeg.",
        "Enter a valid reply-to address or leave it blank.",
      );
    case "INVALID_SMTP_HOST":
      return text(
        "Vul een geldige SMTP-host in of laat alle SMTP-velden leeg voor de centrale relay.",
        "Enter a valid SMTP host or leave all SMTP fields blank to use the central relay.",
      );
    case "INVALID_SMTP_SETTINGS":
      return text(
        "Controleer de SMTP-gebruikersnaam en poort (1–65535).",
        "Check the SMTP username and port (1–65535).",
      );
    case "SMTP_PASSWORD_REQUIRED":
      return text(
        "Vul het wachtwoord van je eigen SMTP-server in.",
        "Enter the password for your own SMTP server.",
      );
    case "DOMAIN_ALREADY_USED":
      return text("Dit domein is al gekoppeld.", "This domain is already linked.");
    default:
      return text(
        "Domein- of e-mailinstellingen konden niet worden opgeslagen. Controleer de ingevulde gegevens.",
        "Domain or email settings could not be saved. Check the entered details.",
      );
  }
}
