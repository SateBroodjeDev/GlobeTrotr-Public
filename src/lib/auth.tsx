import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearOfflineTrips } from "@/lib/offline-trip";
import { clearOfflineJournal } from "@/lib/journal-offline-store";
import { clearAllJournalDrafts } from "@/lib/journal-offline";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, passwordRecovery: false, refreshUser: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let unsubscribe: () => void = () => undefined;
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (!active) return;
        authEventReceived = true;
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (event === "SIGNED_OUT") setPasswordRecovery(false);
        setSession(s);
        setLoading(false);
        if (event === "SIGNED_OUT") {
          try { clearAllJournalDrafts(window.localStorage); } catch { /* Storage may be blocked by the browser. */ }
          void clearOfflineTrips().catch(() => undefined);
          void clearOfflineJournal().catch(() => undefined);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        // INITIAL_SESSION may win this race with fresher state. Never replace it
        // with an older null result from the parallel storage read.
        if (!authEventReceived && !error) setSession(data.session);
        setLoading(false);
      }).catch(() => { if (active) setLoading(false); });
    } catch {
      // Public pages remain accessible if client initialization fails.
      setLoading(false);
    }
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      try {
        void supabase.auth.getSession().then(({ data, error }) => {
          if (active && !error) setSession(data.session);
        }).catch(() => undefined);
      } catch { /* Keep the last session if client initialization is unavailable. */ }
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      unsubscribe();
    };
  }, []);

  async function refreshUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    setSession((current) => current ? { ...current, user: data.user } : current);
  }

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, passwordRecovery, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
