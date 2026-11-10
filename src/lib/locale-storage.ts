export type StoredLocale = "nl-NL" | "en-GB";

const STORAGE_KEY = "globetrotr.locale";
const SESSION_STORAGE_KEY = "globetrotr.locale.session";
const SHARED_LOCALE_COOKIE = "gt_locale";
const PLATFORM_HOSTS = new Set(["globetrotr.nl", "www.globetrotr.nl", "portal.globetrotr.nl", "dashboard.globetrotr.nl"]);

/** Only an explicit language choice crosses first-party hosts; no identity or tracking. */
export function readSharedLocale(cookie: string, hostname: string): StoredLocale | null {
  if (!PLATFORM_HOSTS.has(hostname)) return null;
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${SHARED_LOCALE_COOKIE}=`))?.slice(SHARED_LOCALE_COOKIE.length + 1);
  return validLocale(value ?? null) ? value as StoredLocale : null;
}

export function sharedLocaleCookie(locale: StoredLocale, hostname: string, protocol: string): string | null {
  if (!validLocale(locale) || !PLATFORM_HOSTS.has(hostname) || protocol !== "https:") return null;
  // No Max-Age/Expires: keep the selected language for this browser session only.
  return `${SHARED_LOCALE_COOKIE}=${locale}; Domain=globetrotr.nl; Path=/; SameSite=Lax; Secure`;
}

function validLocale(value: string | null): value is StoredLocale {
  return value === "nl-NL" || value === "en-GB";
}

export function readSavedLocale(
  storage: { session: () => Storage; persistent: () => Storage },
  preferences: boolean,
): StoredLocale | null {
  try {
    const session = storage.session().getItem(SESSION_STORAGE_KEY);
    if (validLocale(session)) return session;
  } catch { /* Storage may be disabled by browser privacy settings. */ }
  if (preferences) {
    try {
      const saved = storage.persistent().getItem(STORAGE_KEY);
      if (validLocale(saved)) return saved;
    } catch { /* Continue with the browser language. */ }
  }
  return null;
}

export function readStoredLocale(
  storage: { session: () => Storage; persistent: () => Storage },
  preferences: boolean,
  browserLanguage: string,
  sharedLocale: StoredLocale | null = null,
): StoredLocale {
  return sharedLocale ?? readSavedLocale(storage, preferences)
    ?? (browserLanguage.toLowerCase().startsWith("nl") ? "nl-NL" : "en-GB");
}

export function rememberLocale(
  storage: { session: () => Storage; persistent: () => Storage },
  locale: StoredLocale,
  preferences: boolean,
) {
  try { storage.session().setItem(SESSION_STORAGE_KEY, locale); } catch { /* Keep the in-memory choice. */ }
  if (preferences) {
    try { storage.persistent().setItem(STORAGE_KEY, locale); } catch { /* Keep the session choice. */ }
  }
}
