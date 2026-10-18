import { mailLocale } from "./mail-locale.mjs";
function localized(value, locale, fallback) {
  const parts = String(value || fallback).split(" / ");
  return String((locale === "en" ? parts[1] : parts[0]) || parts[0]).trim();
}

export function notificationCopy(job) {
  const payload = job.payload && typeof job.payload === "object" ? job.payload : {};
  const locale = mailLocale(job.locale);
  const english = locale === "en";
  const fallback = english ? "GlobeTrotr update" : "GlobeTrotr-update";
  let subject = localized(payload.title, locale, fallback);
  let body = localized(
    payload.body,
    locale,
    english
      ? "Open GlobeTrotr to view your notification."
      : "Open GlobeTrotr om je melding te bekijken.",
  );
  let actionUrl = typeof payload.actionUrl === "string" ? payload.actionUrl : null;
  let severity = null;

  if (["auth", "public_trip_follow", "public_trip_update", "content_report"].includes(job.templateKey)) {
    subject = String(payload.title || fallback);
    body = String(payload.body || (english ? "Open the shared trip to read the update." : "Open de gedeelde reis om de update te lezen."));
    actionUrl = typeof payload.actionUrl === "string" ? payload.actionUrl : "https://globetrotr.nl";
    if (job.templateKey === "content_report") actionUrl = "https://globetrotr.nl/report-content";
  }

  // Bestaande wachtrijregels bevatten nog het interne platformformaat.
  else if (job.templateKey === "platform") {
    const parts = String(payload.body ?? "").split("|");
    if (["status", "update"].includes(parts[0]) && parts.length >= 5) {
      subject = english ? parts[2] || subject : subject;
      body = english ? parts[4] || body : parts[3] || body;
      severity = parts[1] === "critical" ? "critical" : null;
      actionUrl =
        parts[0] === "status" ? "https://globetrotr.nl/status" : "https://globetrotr.nl/updates";
    } else {
      severity = payload.severity === "critical" ? "critical" : null;
      actionUrl ??=
        payload.announcementType === "status"
          ? "https://globetrotr.nl/status"
          : "https://globetrotr.nl/updates";
    }
  } else if (job.templateKey === "account") {
    const parts = String(payload.body ?? "").split("|");
    if (parts[0] === "plan" && parts[1]) {
      subject = english ? "Subscription changed" : "Abonnement gewijzigd";
      body = english
        ? `Your current plan is ${parts[1]}.`
        : `Je huidige abonnement is ${parts[1]}.`;
      actionUrl = "https://portal.globetrotr.nl/billing";
    } else if (parts[0] === "profile") {
      body = english ? "Your profile details have changed." : "Je profielgegevens zijn gewijzigd.";
      actionUrl = "https://portal.globetrotr.nl/account";
    } else if (["Agency-toegang geblokkeerd", "Agency access suspended"].includes(subject)) {
      subject = english ? "Agency access suspended" : "Agency-toegang geblokkeerd";
      body = english
        ? `Your access to ${payload.body || "the Agency workspace"} has been suspended.`
        : `Je toegang tot ${payload.body || "de Agency-workspace"} is geblokkeerd.`;
      actionUrl = "https://portal.globetrotr.nl/account";
    } else if (["Agency-toegang hersteld", "Agency access restored"].includes(subject)) {
      subject = english ? "Agency access restored" : "Agency-toegang hersteld";
      body = english
        ? `Your access to ${payload.body || "the Agency workspace"} has been restored.`
        : `Je toegang tot ${payload.body || "de Agency-workspace"} is hersteld.`;
      actionUrl = "https://portal.globetrotr.nl/agency-admin";
    } else if (["Uit Agency-team verwijderd", "Removed from Agency team"].includes(subject)) {
      subject = english ? "Removed from Agency team" : "Uit Agency-team verwijderd";
      body = english
        ? `You no longer have access to ${payload.body || "the Agency workspace"}.`
        : `Je hebt geen toegang meer tot ${payload.body || "de Agency-workspace"}.`;
      actionUrl = "https://portal.globetrotr.nl/dashboard";
    }
  } else if (job.templateKey === "trip_access") {
    const parts = String(payload.body ?? "").split("|");
    if (parts[0] === "revoked" && parts[1]) {
      body = english
        ? `The invitation for ${parts[1]} was revoked.`
        : `De uitnodiging voor ${parts[1]} is ingetrokken.`;
    } else if (parts[0] === "role" && parts[1]) {
      body = english
        ? `Your role for ${parts[1]} has changed.`
        : `Je rol voor ${parts[1]} is gewijzigd.`;
    }
    actionUrl = "https://portal.globetrotr.nl/dashboard";
  } else if (job.templateKey === "agency_access") {
    const parts = String(payload.body ?? "").split("|");
    const brand = parts[1] || (english ? "your Agency workspace" : "je Agency-workspace");
    if (parts[0] === "role_permissions")
      body = english
        ? `The permissions for the ${parts[2] || "team"} role in ${brand} have changed.`
        : `De rechten voor de rol ${parts[2] || "team"} in ${brand} zijn gewijzigd.`;
    else if (parts[0] === "member_permissions")
      body = english
        ? `Your personal permissions in ${brand} have changed.`
        : `Je persoonlijke rechten in ${brand} zijn gewijzigd.`;
    else if (parts[0] === "role")
      body = english
        ? `Your role in ${brand} is now ${parts[2] || "team member"}.`
        : `Je rol in ${brand} is nu ${parts[2] || "teamlid"}.`;
    else if (parts[0] === "branding")
      body = english
        ? `The branding for ${brand} has changed.`
        : `De huisstijl van ${brand} is gewijzigd.`;
    else if (parts[0] === "trip_branding")
      body = english
        ? `The branding for ${parts[2] || "a trip"} in ${brand} has changed.`
        : `De huisstijl van ${parts[2] || "een reis"} in ${brand} is gewijzigd.`;
    actionUrl = "https://portal.globetrotr.nl/agency-admin";
  } else if (job.templateKey === "trip_settlement") {
    const parts = String(payload.body ?? "").split("|");
    if (parts[0] === "completed")
      body = english
        ? `The settlement for ${parts[1] || "your trip"} has been completed.`
        : `De verrekening voor ${parts[1] || "je reis"} is afgerond.`;
    else if (parts[0] === "request") {
      const amount = parts[3] && parts[4] ? `${parts[3]} ${parts[4]}` : "";
      body = english
        ? `${parts[2] || "A fellow traveller"} sent you a payment request${amount ? ` for ${amount}` : ""} for ${parts[1] || "your trip"}.`
        : `${parts[2] || "Een reisgenoot"} stuurde je een betaalverzoek${amount ? ` van ${amount}` : ""} voor ${parts[1] || "je reis"}.`;
    }
    actionUrl = payload.tripId
      ? `https://portal.globetrotr.nl/trips/${payload.tripId}`
      : "https://portal.globetrotr.nl/dashboard";
  }

  return { subject: subject.slice(0, 160), body: body.slice(0, 5000), actionUrl, severity };
}
