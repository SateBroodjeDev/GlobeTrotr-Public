import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { readPrivacyChoice } from "@/lib/privacy-consent";
import { readStoredLocale, rememberLocale } from "@/lib/locale-storage";

export type AppLocale = "nl-NL" | "en-GB";

type LocaleContextValue = {
  locale: AppLocale;
  language: "nl" | "en";
  setLocale: (locale: AppLocale) => Promise<void>;
  text: (nl: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const browserStorage = {
  session: () => window.sessionStorage,
  persistent: () => window.localStorage,
};

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "nl-NL";
  return readStoredLocale(browserStorage, Boolean(readPrivacyChoice()?.preferences), window.navigator.language);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  // The first browser render must match the Dutch server render. Restore the
  // browser/session choice after hydration, before persisting any new value.
  const [locale, setLocaleState] = useState<AppLocale>("nl-NL");
  const [storageReady, setStorageReady] = useState(false);
  const choiceVersion = useRef(0);

  useEffect(() => {
    setLocaleState(initialLocale());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const version = choiceVersion.current;
    void Promise.resolve(supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!active || error || choiceVersion.current !== version) return;
        if (data?.locale === "nl-NL" || data?.locale === "en-GB") setLocaleState(data.locale);
      }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!storageReady) return;
    document.documentElement.lang = locale === "nl-NL" ? "nl" : "en";
    rememberLocale(browserStorage, locale, Boolean(readPrivacyChoice()?.preferences));
  }, [locale, storageReady]);

  async function setLocale(next: AppLocale) {
    choiceVersion.current += 1;
    setLocaleState(next);
    if (user) {
      const language = next === "nl-NL" ? "nl" : "en";
      const [{ error: profileError }, { error: metadataError }] = await Promise.all([
        supabase.from("profiles").upsert({ id: user.id, locale: next }),
        supabase.auth.updateUser({ data: { language } }),
      ]);
      if (profileError || metadataError) throw profileError ?? metadataError;
    }
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
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
