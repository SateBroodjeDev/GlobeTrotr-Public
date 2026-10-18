import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { supabase } from "@/integrations/supabase/client";
import { getStaffSecurityStatus, prepareGbtLogout } from "@/lib/staff-security.functions";
import { logoutGbt } from "@/lib/staff-logout";
import { toast } from "sonner";
import { getStaffLinkAccess, recordStaffLink } from "@/lib/staff-sso.functions";
import { staffLoginOptions, staffLinkOptions, STAFF_LINK_STORAGE_KEY } from "@/lib/staff-sso";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { staffLoginRequired, authSessionCacheId } from "@/lib/staff-account-access";

export const Route = createFileRoute("/team-login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeInternalRedirect(search.redirect) || "/dashboard",
  }),
  component: TeamLogin,
});
function TeamLogin() {
  const { user, session, loading } = useAuth(),
    { text } = useLocale();
  const { redirect } = Route.useSearch(),
    navigate = useNavigate();
  const destination = redirect.startsWith("/team-login") ? "/dashboard" : redirect;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const security = useQuery({
    queryKey: ["account-session-security", user?.id, authSessionCacheId(session?.access_token)],
    queryFn: () => getStaffSecurityStatus(),
    enabled: Boolean(user) && !loading,
    retry: false,
    refetchInterval: 60_000,
  });
  const link = useQuery({
    queryKey: ["staff-link-access", user?.id],
    queryFn: () => getStaffLinkAccess(),
    enabled: security.data?.isStaff === true,
    retry: false,
  });
  useEffect(() => {
    if (!loading && !user)
      void navigate({ to: "/auth", search: { redirect: destination }, replace: true });
    else if (security.isSuccess && !staffLoginRequired(security.data))
      window.location.replace(destination);
  }, [loading, user, security.isSuccess, security.data, navigate, destination]);
  async function startLogin() {
    setBusy(true);
    setError(false);
    try {
      const result = await supabase.auth.signInWithOAuth(
        staffLoginOptions(destination, text("nl", "en")),
      );
      if (result.error) throw result.error;
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  async function linkIdentity() {
    if (!user || !link.data?.allowed) return;
    if (
      !window.confirm(
        text(
          "Koppel je persoonlijke teamidentiteit aan dit bestaande account. Gebruik geen gedeeld account.",
          "Link your personal team identity to this existing account. Do not use a shared account.",
        ),
      )
    )
      return;
    setBusy(true);
    setError(false);
    try {
      const baseline = await recordStaffLink({ data: { phase: "started" } });
      if (baseline.userId !== user.id) throw new Error("STAFF_LINK_MISMATCH");
      sessionStorage.setItem(
        STAFF_LINK_STORAGE_KEY,
        JSON.stringify({ userId: user.id, expiresAt: Date.now() + 15 * 60_000 }),
      );
      const result = await supabase.auth.linkIdentity(staffLinkOptions());
      if (result.error) throw result.error;
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-xl content-center gap-4 p-6">
      <h1 className="font-display text-2xl font-semibold">
        {text("Log in met je GlobeTrotr Teamaccount", "Sign in with your GlobeTrotr Team Account")}
      </h1>
      <p>
        {text(
          "Voor staff is Teamlogin verplicht, ook voor reizen. Een bestaande passkey of wachtwoord opent je account niet. Je reizen zijn behouden.",
          "Staff must use team sign-in, including for trips. An existing passkey or password does not open your account. Your trips are preserved.",
        )}
      </p>
      {security.data?.isStaff && !security.data.linked && (
        <div className="space-y-3 rounded-xl border p-4">
          <p>
            {text(
              "Nieuw in het team? Stel eerst MFA en herstelcodes in bij je persoonlijke teamaccount. Koppel daarna dat account aan je bestaande GlobeTrotr-account.",
              "New to the team? Set up MFA and recovery codes for your personal team account, then link it to your existing GlobeTrotr account.",
            )}
          </p>
          <Button variant="outline" asChild>
            <a href="https://sso.globetrotr.nl/if/user/" target="_blank" rel="noopener noreferrer">
              {text("Teambeveiliging", "Team security")}
            </a>
          </Button>
          <Button disabled={busy || !link.data?.allowed} onClick={() => void linkIdentity()}>
            {text("Teamaccount koppelen", "Link team account")}
          </Button>
        </div>
      )}
      <Button
        disabled={busy || !security.isSuccess || !security.data.linked}
        onClick={() => void startLogin()}
      >
        {text("Verder met Teamlogin", "Continue with team sign-in")}
      </Button>
      {security.isError && (
        <>
          <p role="alert">
            {text(
              "De beveiligingscontrole is niet beschikbaar. Je account blijft gesloten.",
              "The security check is unavailable. Your account remains closed.",
            )}
          </p>
          <Button variant="outline" onClick={() => void security.refetch()}>
            {text("Opnieuw controleren", "Retry check")}
          </Button>
        </>
      )}
      {error && (
        <p role="alert">
          {text(
            "Teamlogin of koppeling is niet gelukt. Neem contact op met je beheerder.",
            "Team sign-in or linking failed. Contact your administrator.",
          )}
        </p>
      )}
      <Button
        variant="ghost"
        onClick={() => void logoutGbt({
          prepare: () => prepareGbtLogout(),
          signOut: () => supabase.auth.signOut(),
          clear: () => undefined,
          redirect: (url) => window.location.assign(url),
        }).catch(() => toast.error(text("Uitloggen is niet gelukt. Probeer het opnieuw.", "Sign out failed. Please try again.")))}
      >
        {text("Uitloggen", "Sign out")}
      </Button>
      <Link to="/">{text("Terug naar website", "Back to website")}</Link>
    </main>
  );
}
