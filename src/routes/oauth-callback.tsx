import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/locale";
import { STAFF_LINK_STORAGE_KEY, STAFF_SSO_PROVIDER, staffLinkVerified } from "@/lib/staff-sso";
import { recordStaffLink } from "@/lib/staff-sso.functions";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { establishStaffSession, getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getOwnStaffSetup } from "@/lib/staff-mail-setup.functions";

export const Route = createFileRoute("/oauth-callback")({ component: OAuthCallback });

function OAuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { text } = useLocale();
  const [failure, setFailure] = useState("");
  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      try {
        const oauthError = params.get("error_description") || params.get("error");
        if (oauthError) throw new Error(oauthError);
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && !/code verifier/i.test(error.message)) throw error;
        }
        const { data: beforeRefresh } = await supabase.auth.getSession();
        const providerToken = beforeRefresh.session?.provider_token;
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        const user = refreshed.user;
        const linkedProvider = params.get("linked");
        if (linkedProvider === STAFF_SSO_PROVIDER) {
          const pending = JSON.parse(sessionStorage.getItem(STAFF_LINK_STORAGE_KEY) || "null");
          if (
            !pending ||
            !Number.isFinite(pending.expiresAt) ||
            pending.expiresAt < Date.now() ||
            !staffLinkVerified(pending.userId, user)
          ) {
            throw new Error("STAFF_ACCOUNT_LINK_MISMATCH");
          }
          const verified = await recordStaffLink({ data: { phase: "completed" } });
          if (verified.userId !== pending.userId) throw new Error("STAFF_ACCOUNT_LINK_MISMATCH");
          sessionStorage.removeItem(STAFF_LINK_STORAGE_KEY);
        }
        if (
          linkedProvider &&
          !user?.identities?.some((identity) => identity.provider === linkedProvider)
        ) {
          throw new Error("IDENTITY_ALREADY_LINKED_TO_ANOTHER_ACCOUNT");
        }
        const next = params.get("next");
        let safeNext = safeInternalRedirect(next) ?? "/dashboard";
        if (params.get("staff") === "1") {
          const status = await getStaffSecurityStatus();
          if (status.enforced || status.proofConfigured) {
            if (!providerToken) throw new Error("STAFF_PROOF_REQUIRED");
            const proof = await establishStaffSession({ data: { providerToken } });
            const setup = await getOwnStaffSetup();
            if (
              setup.managed &&
              setup.enabled &&
              setup.mailAllowed &&
              setup.mailbox &&
              !setup.mailbox.connected
            )
              safeNext = "/team-setup";
            await queryClient.invalidateQueries({ queryKey: ["account-session-security"] });
            await Promise.all(
              ["profile-theme", "profile-settings", "profile"].map((key) =>
                queryClient.invalidateQueries({ queryKey: [key, user?.id] }),
              ),
            );
            if (["failed", "not_configured", "needs_link"].includes(proof.profileSync))
              toast.warning(
                text(
                  "Teamlogin geslaagd. Je GlobeTrotr-profiel is behouden; teamsynchronisatie vraagt nog aandacht van je beheerder.",
                  "Team sign-in succeeded. Your GlobeTrotr profile is preserved; team synchronization needs your administrator's attention.",
                ),
              );
          }
        }
        if (!params.has("linked") && user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("id", user.id)
            .maybeSingle();
          const fresh = Date.now() - Date.parse(user.created_at) < 15 * 60_000;
          const selectedLanguage = params.get("language") === "nl" ? "nl" : "en";
          if (fresh) {
            const selectedLocale = selectedLanguage === "nl" ? "nl-NL" : "en-GB";
            await Promise.all([
              supabase.from("profiles").upsert({ id: user.id, locale: selectedLocale }),
              supabase.auth.updateUser({ data: { language: selectedLanguage } }),
            ]);
          }
          if (fresh && !profile?.onboarding_completed_at) {
            await navigate({ to: "/complete-profile", search: { next: safeNext }, replace: true });
            return;
          }
        }
        await navigate({ to: params.has("linked") ? "/account" : safeNext, replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "OAUTH_LINK_FAILED";
        setFailure(
          params.get("staff") === "1"
            ? "staff-login"
            : params.get("linked") === STAFF_SSO_PROVIDER
              ? "staff"
              : /already|exists|linked/i.test(message)
                ? "identity"
                : "generic",
        );
      }
    })();
  }, [navigate, queryClient]);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        {failure ? (
          <>
            <h1 className="font-display text-xl font-semibold">
              {failure === "staff-login"
                ? text("Teamlogin niet bevestigd", "Team sign-in not verified")
                : text("Koppelen mislukt", "Linking failed")}
            </h1>
            {failure === "staff-login" && (
              <p className="mt-2 text-sm">
                {text(
                  "Beheer blijft gesloten. Probeer Teamlogin opnieuw of vraag je beheerder de provider- en sessieconfiguratie te controleren.",
                  "Administration remains closed. Retry team sign-in or ask your administrator to check provider and session configuration.",
                )}
              </p>
            )}
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {failure === "staff"
                ? text(
                    "De teamkoppeling kon niet worden bevestigd voor je oorspronkelijke account. Gebruik je bestaande login en neem contact op met je beheerder.",
                    "Team linking could not be verified for your original account. Use your existing sign-in and contact your administrator.",
                  )
                : failure === "identity"
                  ? text(
                      "Dit Google- of Discord-account hoort al bij een ander GlobeTrotr-account. Log daar in of ontkoppel het daar eerst.",
                      "This Google or Discord account already belongs to another GlobeTrotr account. Sign in there or unlink it first.",
                    )
                  : text(
                      "De inlogmethode kon niet worden gekoppeld. Probeer het opnieuw of neem contact op met support.",
                      "The sign-in method could not be linked. Try again or contact support.",
                    )}
            </p>
            <a className="mt-3 inline-block text-primary underline" href="/account">
              {text("Terug naar account", "Back to account")}
            </a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-7 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              {text("Inlogmethode koppelen…", "Linking sign-in method…")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
