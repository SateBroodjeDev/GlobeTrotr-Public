import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrivacySyncContext } from "@/lib/privacy-sync-context";
import { useAuth } from "@/lib/auth";
import { clearPrivacyChoice, readPrivacyChoice, savePrivacyChoice } from "@/lib/privacy-consent";
import { clearAnalyticsChoice, readAnalyticsChoice, saveAnalyticsChoice } from "@/lib/analytics";
import { getAccountPrivacyChoice, saveAccountPrivacyChoice } from "@/lib/privacy-sync.functions";
import { clearSharedPrivacyChoice, reconcilePrivacyChoice, PRIVACY_PURPOSE_VERSION, readSharedPrivacyChoice, writeSharedPrivacyChoice, type SyncedPrivacyChoice } from "@/lib/privacy-sync";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale";

function apply(choice: SyncedPrivacyChoice) {
  writeSharedPrivacyChoice(choice);
  savePrivacyChoice(choice.preferences, choice.decidedAt);
  saveAnalyticsChoice(choice.analytics, choice.decidedAt);
}
export function PrivacySync({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { text } = useLocale();
  const id = user?.id ?? null;
  const [resolved, setResolved] = useState<string | null | undefined>(undefined);
  const sequence = useRef(0);
  const saveBusy = useRef(false);
  useEffect(() => {
    ++sequence.current;
    if (loading) return;
    let active = true;
    const sync = async () => {
      if (saveBusy.current) return;
      const ticket = ++sequence.current;
      try {
        let shared = readSharedPrivacyChoice();
        // Preserve old refusals across hosts. Old opt-ins require a new scoped choice.
        if (!shared && readAnalyticsChoice() === false) shared = { preferences: readPrivacyChoice()?.preferences ?? false,
          analytics: false, purposeVersion: PRIVACY_PURPOSE_VERSION, decidedAt: new Date().toISOString(), accountLinked: false };
        let choice = shared;
        if (id) {
          const remote = await getAccountPrivacyChoice();
          if (!active || ticket !== sequence.current) return;
          const resolution = reconcilePrivacyChoice(shared, remote);
          choice = resolution.choice;
          // A new explicit device choice (including withdrawal) can update the account.
          // Never import another signed-in account's cookie into an empty account.
          if (resolution.upload && choice)
            choice = await saveAccountPrivacyChoice({ data: { preferences: choice.preferences, analytics: choice.analytics, decidedAt: choice.decidedAt } });
        }
        if (!active || ticket !== sequence.current) return;
        if (choice) apply(choice);
        else if (id) { clearSharedPrivacyChoice(); clearPrivacyChoice(); clearAnalyticsChoice(); }
        setResolved(id);
        window.dispatchEvent(new Event("globetrotr:privacy-synced"));
      } catch {
        if (active && ticket === sequence.current) setResolved(undefined); // Fail closed for Analytics.
      }
    };
    void sync();
    const refresh = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [id, loading]);
  async function save(preferences: boolean, analytics: boolean) {
    saveBusy.current = true;
    const ticket = ++sequence.current;
    let choice: SyncedPrivacyChoice = { preferences, analytics, purposeVersion: PRIVACY_PURPOSE_VERSION,
      decidedAt: new Date().toISOString(), accountLinked: false };
    try {
      if (id) choice = await saveAccountPrivacyChoice({ data: { preferences, analytics } });
      if (ticket !== sequence.current) return;
      apply(choice);
      setResolved(id);
    } catch {
      if (ticket !== sequence.current) return;
      // Honour refusal locally even when the account cannot be reached; retry on refresh.
      apply({ ...choice, analytics: false });
      setResolved(undefined);
      toast.error(text("Je lokale keuze is opgeslagen, maar accountsynchronisatie is mislukt. Analytics blijft uit; probeer opnieuw.", "Your local choice was saved, but account sync failed. Analytics stays off; please retry."));
    } finally { saveBusy.current = false; }
  }
  return <PrivacySyncContext.Provider value={{ ready: !loading && resolved === id, save }}>{children}</PrivacySyncContext.Provider>;
}
