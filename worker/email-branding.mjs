import { mailLocale } from "./mail-locale.mjs";
function clean(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(clean(value, 2_000));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeEmail(value) {
  const email = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function emailBranding(payload, locale = "en") {
  locale = mailLocale(locale);
  const source = payload?.branding && typeof payload.branding === "object" ? payload.branding : {};
  const agency = /^[0-9a-f-]{36}$/i.test(String(source.workspaceId || ""));
  const hue = Number(source.accentHue);
  const accent = Number.isFinite(hue)
    ? `hsl(${Math.min(360, Math.max(0, hue))} 70% 34%)`
    : "#168b78";

  if (!agency) {
    return {
      agency: false,
      name: "GlobeTrotr",
      tagline: "Plan every trip. Track every euro.",
      contactEmail: "",
      logoUrl: "https://globetrotr.nl/assets/email/logo.png",
      accent,
      serviceNote:
        locale === "en"
          ? "This is a service message from GlobeTrotr."
          : "Dit is een servicemelding van GlobeTrotr.",
    };
  }

  const name = clean(source.brandName, 100) || "Travel agency";
  return {
    agency: true,
    name,
    tagline: clean(source.tagline, 120),
    contactEmail: safeEmail(source.contactEmail),
    logoUrl: safeHttpsUrl(source.logoUrl),
    accent,
    serviceNote:
      locale === "en"
        ? `This is a service message from ${name}.`
        : `Dit is een servicemelding van ${name}.`,
  };
}

export function publicAgencyLogoUrl(supabaseUrl, logoPath) {
  const path = clean(logoPath, 300);
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) return "";
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${String(supabaseUrl).replace(/\/$/, "")}/storage/v1/object/public/agency-logos/${encodedPath}`;
}

function safePortalHost(value) {
  const host = clean(value, 253).toLowerCase();
  if (!host || host === "localhost" || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)) return "";
  if (!host.includes(".") || host.includes("..")) return "";
  return host;
}

export function emailPreferenceFooter(templateKey, locale = "en", portalHost = "") {
  const english = mailLocale(locale) === "en";
    if (templateKey === "auth") {
      return { note: english ? "This essential message concerns your account security. Did not request this? Ignore this email."
        : "Dit noodzakelijke bericht gaat over je accountbeveiliging. Niet aangevraagd? Negeer deze mail.", url: "", label: "" };
    }
  if (templateKey === "content_report") {
    return { note: english ? "This essential service message concerns a content notice or moderation decision. For reconsideration, contact info@globetrotr.nl quoting the case number."
      : "Dit noodzakelijke servicebericht betreft een inhoudsmelding of moderatiebesluit. Vraag herbeoordeling via info@globetrotr.nl met het dossiernummer.", url: "", label: "" };
  }
  if (templateKey === "account_deletion") {
    return {
      note: english
        ? "This essential message confirms the permanent deletion of your account. There are no remaining email preferences to manage."
        : "Dit noodzakelijke bericht bevestigt de definitieve verwijdering van je account. Er zijn geen e-mailvoorkeuren meer om te beheren.",
      url: "",
      label: "",
    };
  }
  if (templateKey === "public_trip_update") {
    return {
      note: english
        ? "You can stop these voluntary travel updates using the unsubscribe link above."
        : "Je kunt deze vrijwillige reisupdates stoppen via de afmeldlink hierboven.",
      url: "",
      label: "",
    };
  }
  if (templateKey === "public_trip_follow") {
    return {
      note: english
        ? "Following only starts after your confirmation. Every travel update contains an unsubscribe link."
        : "Volgen start pas na je bevestiging. Iedere reisupdate bevat een afmeldlink.",
      url: "",
      label: "",
    };
  }
  const host = safePortalHost(portalHost) || "portal.globetrotr.nl";
  return {
    note: english
      ? "Manage optional email preferences in your account. Security and essential account messages remain enabled."
      : "Beheer optionele e-mailvoorkeuren in je account. Beveiligings- en noodzakelijke accountberichten blijven aan.",
    url: `https://${host}/account#communication`,
    label: english ? "Manage email preferences" : "E-mailvoorkeuren beheren",
  };
}
