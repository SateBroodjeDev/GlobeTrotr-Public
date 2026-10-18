import { readSharedPrivacyChoice } from "./privacy-sync.ts";
export const PRIVACY_CHOICE_KEY = "globetrotr.privacy-choice.v2";

export type PrivacyChoice = {
  version: 2;
  preferences: boolean;
  decidedAt: string;
};

let sessionChoice: PrivacyChoice | null = null;

export function readPrivacyChoice(): PrivacyChoice | null {
  if (typeof window === "undefined") return null;
  const shared = readSharedPrivacyChoice();
  if (shared) return { version: 2, preferences: shared.preferences, decidedAt: shared.decidedAt };
  try {
    const value = JSON.parse(window.localStorage.getItem(PRIVACY_CHOICE_KEY) ?? "null") as Partial<PrivacyChoice> | null;
    return value?.version === 2 && typeof value.preferences === "boolean" && typeof value.decidedAt === "string"
      ? (value as PrivacyChoice)
      : sessionChoice;
  } catch {
    return sessionChoice;
  }
}

export function savePrivacyChoice(preferences: boolean, decidedAt = new Date().toISOString()) {
  const choice: PrivacyChoice = { version: 2, preferences, decidedAt };
  sessionChoice = choice;
  try {
    window.localStorage.setItem(PRIVACY_CHOICE_KEY, JSON.stringify(choice));
    window.localStorage.removeItem("globetrotr.privacy-choice.v1");
    if (!preferences) window.localStorage.removeItem("globetrotr.locale");
  } catch { /* A blocked/full store must still let the visitor dismiss the choice. */ }
  window.dispatchEvent(new CustomEvent("globetrotr:privacy-choice", { detail: choice }));
}

export function openPrivacyChoices() {
  window.dispatchEvent(new Event("globetrotr:open-privacy-choices"));
}
export function clearPrivacyChoice() {
  sessionChoice = null;
  try { window.localStorage.removeItem(PRIVACY_CHOICE_KEY); window.localStorage.removeItem("globetrotr.locale"); } catch { /* Blocked storage. */ }
  window.dispatchEvent(new Event("globetrotr:privacy-choice"));
}
