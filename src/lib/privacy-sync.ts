export const PRIVACY_PURPOSE_VERSION = "2026-10-09-account-sync";
export const SHARED_PRIVACY_COOKIE = "gt_privacy_choice";
const SHARED_PRIVACY_STORAGE = "globetrotr.shared-privacy.v1";
let sessionShared: SyncedPrivacyChoice | null = null;
let suppressedBefore = 0;
export type SyncedPrivacyChoice = {
  preferences: boolean; analytics: boolean; decidedAt: string;
  purposeVersion: string; accountLinked: boolean;
};
export function parseSyncedPrivacyChoice(input: unknown): SyncedPrivacyChoice | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<SyncedPrivacyChoice>;
  if (typeof value.preferences !== "boolean" || typeof value.analytics !== "boolean" ||
    value.purposeVersion !== PRIVACY_PURPOSE_VERSION || typeof value.accountLinked !== "boolean" ||
    typeof value.decidedAt !== "string" || !Number.isFinite(Date.parse(value.decidedAt)) ||
    Date.parse(value.decidedAt) > Date.now() + 60_000 || Date.now() - Date.parse(value.decidedAt) >= 365 * 86400_000) return null;
  return { preferences: value.preferences, analytics: value.analytics, decidedAt: value.decidedAt,
    purposeVersion: value.purposeVersion, accountLinked: value.accountLinked };
}
export function readSharedPrivacyChoice(): SyncedPrivacyChoice | null {
  if (typeof document === "undefined") return null;
  let stored: SyncedPrivacyChoice | null = null;
  let cookie: SyncedPrivacyChoice | null = null;
  try {
    const encoded = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${SHARED_PRIVACY_COOKIE}=`))?.slice(SHARED_PRIVACY_COOKIE.length + 1);
    cookie = encoded ? parseSyncedPrivacyChoice(JSON.parse(decodeURIComponent(encoded))) : null;
  } catch { /* Malformed or inaccessible cookie. */ }
  try { stored = parseSyncedPrivacyChoice(JSON.parse(window.localStorage.getItem(SHARED_PRIVACY_STORAGE) ?? "null")); } catch { /* Blocked storage. */ }
  return [cookie, stored, parseSyncedPrivacyChoice(sessionShared)].filter((choice): choice is SyncedPrivacyChoice => Boolean(choice && Date.parse(choice.decidedAt) > suppressedBefore))
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt) || Number(a.analytics) - Number(b.analytics))[0] ?? null;
}
export function reconcilePrivacyChoice(local: SyncedPrivacyChoice | null, account: SyncedPrivacyChoice | null) {
  const remote = parseSyncedPrivacyChoice(account);
  const device = parseSyncedPrivacyChoice(local);
  const upload = Boolean(device && !device.accountLinked && (!account || Date.parse(device.decidedAt) > Date.parse(account.decidedAt)));
  return { upload, choice: upload ? device : remote };
}
export function writeSharedPrivacyChoice(choice: SyncedPrivacyChoice) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  sessionShared = choice;
  suppressedBefore = 0;
  try { window.localStorage.setItem(SHARED_PRIVACY_STORAGE, JSON.stringify(choice)); } catch { /* Session fallback. */ }
  // Only the two first-party hosts share this necessary choice cookie. No IDs/tokens.
  if (!["globetrotr.nl", "portal.globetrotr.nl"].includes(window.location.hostname)) return;
  const remaining = Math.max(0, Math.min(31536000, Math.ceil((Date.parse(choice.decidedAt) + 365 * 86400_000 - Date.now()) / 1000)));
  document.cookie = `${SHARED_PRIVACY_COOKIE}=${encodeURIComponent(JSON.stringify(choice))}; Domain=globetrotr.nl; Path=/; Max-Age=${remaining}; SameSite=Lax; Secure`;
}
export function clearSharedPrivacyChoice() {
  sessionShared = null;
  suppressedBefore = Date.now();
  try { window.localStorage.removeItem(SHARED_PRIVACY_STORAGE); } catch { /* Blocked storage. */ }
  if (typeof document !== "undefined") document.cookie = `${SHARED_PRIVACY_COOKIE}=; Domain=globetrotr.nl; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
