export type ContentNotice = {
  name: string; email: string; url: string; location: string; explanation: string;
  childSafetyException: boolean; goodFaith: boolean; locale: string;
};
export function validateContentNotice(input: ContentNotice): ContentNotice {
  if (!input || [input.name, input.email, input.url, input.location, input.explanation].some(value => typeof value !== "string") ||
    typeof input.childSafetyException !== "boolean" || input.goodFaith !== true) throw new Error("INVALID_NOTICE");
  const name = input.name.trim(), email = input.email.trim().toLowerCase();
  if (name.length > 100 || email.length > 254 || (!input.childSafetyException && (name.length < 2 || !email)) ||
    (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new Error("INVALID_NOTICE");
  let url: URL;
  try { url = new URL(input.url); } catch { throw new Error("INVALID_NOTICE"); }
  if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2000 ||
    input.location.trim().length > 500 || input.explanation.trim().length < 20 || input.explanation.trim().length > 3000)
    throw new Error("INVALID_NOTICE");
  // No fetch, preview, telemetry or automatic navigation to the submitted URL.
  return { name, email, url: url.href, location: input.location.trim(), explanation: input.explanation.trim(),
    childSafetyException: input.childSafetyException, goodFaith: true, locale: contentReportLanguage(input.locale) };
}
export type ContentDecision = { id: string; action: "no_action" | "restriction"; facts: string; basis: string;
  scope: string; duration: string; affectedUserId: string; contactUnavailableReason: string; implemented: boolean };
export function validateContentDecision(input: ContentDecision): ContentDecision {
  if (!input || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) ||
    !["no_action", "restriction"].includes(input.action)) throw new Error("INVALID_DECISION");
  for (const [key, min, max] of [["facts", 20, 600], ["basis", 10, 400], ["scope", 2, 100], ["duration", 2, 100]] as const)
    if (typeof input[key] !== "string" || input[key].trim().length < min || input[key].trim().length > max) throw new Error("INVALID_DECISION");
  if (typeof input.affectedUserId !== "string" || typeof input.contactUnavailableReason !== "string" || input.contactUnavailableReason.length > 300 ||
    (input.affectedUserId && !/^[0-9a-f-]{36}$/i.test(input.affectedUserId)) ||
    (input.action === "restriction" && (input.implemented !== true || (!input.affectedUserId && input.contactUnavailableReason.trim().length < 10))))
    throw new Error("INVALID_DECISION");
  return { ...input, facts: input.facts.trim(), basis: input.basis.trim(), scope: input.scope.trim(), duration: input.duration.trim() };
}
export function contentReportLanguage(locale: unknown): "nl" | "en" {
  return typeof locale === "string" && /^en(?:-|$)/i.test(locale) ? "en" : "nl";
}

export function decisionMessage(decision: ContentDecision, locale: string) {
  const en = contentReportLanguage(locale) === "en";
  const body = en
    ? `Case ${decision.id}\nDecision: ${decision.action === "no_action" ? "No restriction" : "Restriction applied"}\nFacts: ${decision.facts}\nLegal or contractual basis and explanation: ${decision.basis}\nMeasure and geographical scope: ${decision.scope}\nDuration: ${decision.duration}\nHuman assessment following a notice; no automated detection or decision.\nFor reconsideration, email info@globetrotr.nl with this case number and your reasons. Judicial remedies remain available; applicable out-of-court remedies may also be available.`
    : `Dossier ${decision.id}\nBesluit: ${decision.action === "no_action" ? "Geen beperking" : "Beperking toegepast"}\nFeiten: ${decision.facts}\nWettelijke of contractuele grondslag en uitleg: ${decision.basis}\nMaatregel en geografisch bereik: ${decision.scope}\nDuur: ${decision.duration}\nMenselijke beoordeling naar aanleiding van een melding; geen automatische detectie of besluitvorming.\nVraag herbeoordeling via info@globetrotr.nl met dit dossiernummer en je redenen. De gang naar de rechter blijft open; toepasselijke buitengerechtelijke mogelijkheden kunnen daarnaast beschikbaar zijn.`;
  if (new TextEncoder().encode(JSON.stringify({ title: "GlobeTrotr", body })).length > 3700) throw new Error("DECISION_TOO_LONG");
  return body;
}
