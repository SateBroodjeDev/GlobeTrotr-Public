import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { readPrivacyChoice } from "@/lib/privacy-consent";
import { readSavedLocale, readSharedLocale, readStoredLocale, rememberLocale, sharedLocaleCookie } from "@/lib/locale-storage";
import { localizedMarketingPath, type MarketingLocale } from "@/lib/marketing-locale";
import { profileLocale, resolveLocale } from "@/lib/locale-policy";
import { savePortalLocale, usePortalSessionSummary } from "@/lib/public-session";

export type AppLocale = "nl-NL" | "en-GB";

type LocaleContextValue = {
  locale: AppLocale;
  language: "nl" | "en";
  languageReady: boolean;
  setLocale: (locale: AppLocale) => Promise<void>;
  text: (nl: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const browserStorage = {
  session: () => window.sessionStorage,
  persistent: () => window.localStorage,
};

function sharedLocale(): AppLocale | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try { return readSharedLocale(document.cookie, window.location.hostname); }
  catch { return null; }
}

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "nl-NL";
  const preferences = Boolean(readPrivacyChoice()?.preferences);
  // Carry choices saved before cross-host sync existed, not just new toggles.
  const saved = sharedLocale() ?? readSavedLocale(browserStorage, preferences);
  if (saved) rememberSharedLocale(saved);
  return readStoredLocale(browserStorage, preferences, window.navigator.language, saved);
}

function rememberSharedLocale(next: AppLocale) {
  try {
    const cookie = sharedLocaleCookie(next, window.location.hostname, window.location.protocol);
    if (cookie) document.cookie = cookie;
  } catch { /* Blocked cookies must not prevent changing the current language. */ }
}

export function LocaleProvider({ children, urlLocale }: { children: ReactNode; urlLocale?: MarketingLocale }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  // Public URLs control both SSR and hydration. Other routes restore the saved
  // account/session choice after the matching initial server render.
  const [storedLocale, setLocaleState] = useState<AppLocale>(urlLocale ?? "nl-NL");
  const { summary, verified, languageReady: portalLanguageReady } = usePortalSessionSummary();
  const [account, setAccount] = useState<{ id: string; locale: AppLocale }>();
  const [choice, setChoice] = useState<AppLocale>();
  const [refresh, setRefresh] = useState(0);
  const saving = useRef(false);
  const accountLocale = userId
    ? (account?.id === userId ? account.locale : undefined)
    : verified ? summary?.locale : undefined;
  const locale = resolveLocale({ choice, account: accountLocale, url: urlLocale, stored: storedLocale });
  const languageReady = !authLoading && portalLanguageReady;
  const [storageReady, setStorageReady] = useState(false);
  const choiceVersion = useRef(0);

  useEffect(() => { setChoice(undefined); }, [userId]);

  useEffect(() => {
    setLocaleState(urlLocale ?? initialLocale());
    setStorageReady(true);
    const syncSharedLocale = (event: Event) => {
      // A restored document can still contain the choice made just before it
      // navigated away. Resolve its URL/account again instead of replaying it.
      if (event.type === "pageshow" && !saving.current) setChoice(undefined);
      const choice = sharedLocale();
      if (!urlLocale && choice) setLocaleState(choice);
      setRefresh((value) => value + 1);
    };
    // Also refresh pages restored from the back/forward cache or another tab.
    window.addEventListener("pageshow", syncSharedLocale);
    window.addEventListener("focus", syncSharedLocale);
    return () => {
      window.removeEventListener("pageshow", syncSharedLocale);
      window.removeEventListener("focus", syncSharedLocale);
    };
  }, [urlLocale]);

  useEffect(() => {
    if (!userId || saving.current) return;
    let active = true;
    const version = choiceVersion.current;
    void Promise.resolve(supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!active || error || choiceVersion.current !== version) return;
        const next = profileLocale(data?.locale, user?.user_metadata.language);
        if (next) setAccount({ id: userId, locale: next });
      }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId, user?.user_metadata.language, refresh]);

  useEffect(() => {
    if (!saving.current && choice === accountLocale) setChoice(undefined);
  }, [choice, accountLocale]);

  useEffect(() => {
    if (!urlLocale || !accountLocale || choice || saving.current) return;
    const target = localizedMarketingPath(window.location.pathname, accountLocale);
    if (target !== window.location.pathname) {
      window.location.replace(`${target}${window.location.search}${window.location.hash}`);
    }
  }, [urlLocale, accountLocale, choice]);

  useEffect(() => {
    if (!storageReady) return;
    document.documentElement.lang = locale === "nl-NL" ? "nl" : "en";
    rememberLocale(browserStorage, locale, Boolean(readPrivacyChoice()?.preferences));
    // Opening a public URL must never overwrite a signed-in account preference.
    if (accountLocale || (!userId && verified && !summary)) rememberSharedLocale(locale);
  }, [locale, storageReady, accountLocale, userId, verified, summary]);

  async function setLocale(next: AppLocale) {
    if (!languageReady) throw new Error("Language preference is still loading");
    if (saving.current) return;
    saving.current = true;
    const previous = locale;
    choiceVersion.current += 1;
    setChoice(next);
    setLocaleState(next);
    // Store synchronously so a direct click to the portal cannot outrun React effects.
    rememberLocale(browserStorage, next, Boolean(readPrivacyChoice()?.preferences));
    rememberSharedLocale(next);
    const target = urlLocale ? localizedMarketingPath(window.location.pathname, next) : null;
    try {
      if (user) {
        const language = next === "nl-NL" ? "nl" : "en";
        const [{ error: profileError }, { error: metadataError }] = await Promise.all([
          supabase.from("profiles").upsert({ id: user.id, locale: next }),
          supabase.auth.updateUser({ data: { language } }),
        ]);
        if (profileError || metadataError) throw profileError ?? metadataError;
        setAccount({ id: user.id, locale: next });
      } else if (verified && summary?.authenticated) {
        await savePortalLocale(next);
      }
    } catch (error) {
      setChoice(undefined);
      setLocaleState(previous);
      rememberLocale(browserStorage, previous, Boolean(readPrivacyChoice()?.preferences));
      rememberSharedLocale(previous);
      throw error;
    } finally {
      saving.current = false;
    }
    if (target && target !== window.location.pathname) {
      window.location.assign(`${target}${window.location.search}${window.location.hash}`);
    }
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
        languageReady,
        language: locale === "nl-NL" ? "nl" : "en",
        setLocale,
        text: (nl, en) => (locale === "nl-NL" ? nl : en),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
