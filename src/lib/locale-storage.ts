export type StoredLocale = "nl-NL" | "en-GB";

const STORAGE_KEY = "globetrotr.locale";
const SESSION_STORAGE_KEY = "globetrotr.locale.session";

function validLocale(value: string | null): value is StoredLocale {
  return value === "nl-NL" || value === "en-GB";
}

export function readStoredLocale(
  storage: { session: () => Storage; persistent: () => Storage },
  preferences: boolean,
  browserLanguage: string,
): StoredLocale {
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
  return browserLanguage.toLowerCase().startsWith("nl") ? "nl-NL" : "en-GB";
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
