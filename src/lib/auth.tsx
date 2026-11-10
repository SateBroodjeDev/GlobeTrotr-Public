import { accountTransitions, refreshAccountSession } from "./account-transition";
import { useQueryClient } from "@tanstack/react-query";
import { changeBrowserPushAccount } from "./push-account";
import { createContext, useContext, useEffect, useState, Fragment, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { changeOfflineAccount } from "@/lib/offline-account";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, passwordRecovery: false, refreshUser: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let unsubscribe: () => void = () => undefined;
    const transitions = accountTransitions<Session>({
      publish: (next, busy) => { if (active) { setSession(next); setLoading(busy); } },
      clearQueries: () => { void queryClient.cancelQueries(); queryClient.clear(); },
      offline: changeOfflineAccount, push: changeBrowserPushAccount,
      signOut: () => supabase.auth.signOut({ scope: "local" }),
    });
    const acceptSession = (next: Session | null) => { void transitions.accept(next); };
    const lockAccount = () => transitions.lock();
    window.addEventListener("globetrotr:account-lock", lockAccount);
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (!active) return;
        authEventReceived = true;
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (event === "SIGNED_OUT") setPasswordRecovery(false);
        if (event === "SIGNED_OUT") setSession(null);
        acceptSession(s);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        // INITIAL_SESSION may win this race with fresher state. Never replace it
        // with an older null result from the parallel storage read.
        if (!authEventReceived && !error) acceptSession(data.session);
        else if (!authEventReceived) setLoading(false);
      }).catch(() => { if (active) setLoading(false); });
    } catch {
      // Public pages remain accessible if client initialization fails.
      setLoading(false);
    }
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      try {
        void supabase.auth.getSession().then(({ data, error }) => {
          if (active && !error) acceptSession(data.session);
        }).catch(() => undefined);
      } catch { /* Keep the last session if client initialization is unavailable. */ }
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      active = false;
      transitions.dispose();
      window.removeEventListener("globetrotr:account-lock", lockAccount);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      unsubscribe();
    };
  }, [queryClient]);

  async function refreshUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    setSession((current) => refreshAccountSession(current, data.user));
  }

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, passwordRecovery, refreshUser }}>
      <Fragment key={session?.user.id ?? "signed-out"}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
