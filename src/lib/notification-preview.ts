type PreviewNotification = { kind?: string; title?: string; body?: string };

export function notificationPreview(item: PreviewNotification, locale: "nl" | "en") {
  const english = locale === "en";
  const titles = String(item.title ?? "").split(" / ");
  let title = (english ? titles[1] : titles[0]) || titles[0] || (english ? "New notification" : "Nieuwe melding");
  let description = String(item.body ?? "");
  const parts = description.split("|");

  if (item.kind === "platform" && ["status", "update"].includes(parts[0]) && parts.length >= 5) {
    title = english ? parts[2] || title : title;
    description = english ? parts[4] || "" : parts[3] || "";
  } else if (item.kind === "account" && parts[0] === "plan" && parts[1]) {
    title = english ? "Subscription changed" : "Abonnement gewijzigd";
    description = english ? `Your current plan is ${parts[1]}.` : `Je huidige abonnement is ${parts[1]}.`;
  } else if (item.kind === "trip_access" && parts[0] === "revoked" && parts[1]) {
    description = english ? `The invitation for ${parts[1]} was revoked.` : `De uitnodiging voor ${parts[1]} is ingetrokken.`;
  } else if (description.includes(" / ")) {
    const localized = description.split(" / ");
    description = (english ? localized[1] : localized[0]) || localized[0];
  } else if (description.includes("|")) {
    description = description.replaceAll("|", " · ");
  }
  return { title, description: description.slice(0, 220) };
}
