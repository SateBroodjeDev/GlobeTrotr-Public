import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { authEmailHasError } from "@/lib/auth-email-flow";
import { useLocale } from "@/lib/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({ ssr: false, component: ResetPassword });

function ResetPassword() {
  const { text } = useLocale();
  const [state, setState] = useState<"loading" | "ready" | "staff" | "invalid" | "done">("loading");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (authEmailHasError(window.location.search, window.location.hash)) {
          throw new Error("RECOVERY_LINK_INVALID");
        }
        // Await SDK initialization first: it may already exchange and remove a
        // PKCE code from the URL. Never attempt to consume that code twice.
        let { data, error: sessionError } = await supabase.auth.getSession();
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          if (result.error) throw result.error;
          ({ data, error: sessionError } = await supabase.auth.getSession());
          window.history.replaceState(null, "", "/reset-password");
        }
        if (sessionError || !data.session) throw new Error("RECOVERY_SESSION_REQUIRED");
        const status = await getStaffSecurityStatus();
        if (active) setState(status.isStaff ? "staff" : "ready");
      } catch {
        if (active) setState("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    if (password.length < 6 || password !== repeat) {
      setError(
        text(
          "Gebruik minimaal 6 tekens en herhaal hetzelfde wachtwoord.",
          "Use at least 6 characters and repeat the same password.",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Recheck promotion to staff before submitting. The Auth database also
      // rejects native password changes for staff, including direct API calls.
      if ((await getStaffSecurityStatus()).isStaff) {
        setState("staff");
        return;
      }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword("");
      setRepeat("");
      await supabase.auth.signOut({ scope: "local" });
      setState("done");
    } catch {
      setError(
        text(
          "Het wachtwoord kon niet worden gewijzigd. Vraag een nieuwe link aan. Teamaccounts gebruiken Teamlogin.",
          "The password could not be changed. Request a new link. Team accounts use team sign-in.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>{text("Nieuw wachtwoord kiezen", "Choose a new password")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <p>{text("Herstellink controleren…", "Checking recovery link…")}</p>
          )}
          {state === "staff" && (
            <>
              <p>
                {text(
                  "Dit is een teamaccount. Je logt in via GlobeTrotr Teamlogin. Wachtwoordherstel en magic links voor gewone accounts zijn hiervoor niet beschikbaar. Beheer je teamwachtwoord via Teambeveiliging of vraag je beheerder om hulp.",
                  "This is a team account. Sign in through GlobeTrotr Teamlogin. Regular password recovery and magic links are unavailable for team accounts. Manage your team password in team security or ask your administrator for help.",
                )}
              </p>
              <Button asChild>
                <Link to="/team-login" search={{ redirect: "/dashboard" }}>Teamlogin</Link>
              </Button>
              <a className="block text-sm text-primary underline" href="https://sso.globetrotr.nl/">
                {text("Teambeveiliging", "Team security")}
              </a>
            </>
          )}
          {state === "invalid" && (
            <>
              <p>
                {text(
                  "De herstellink is ongeldig of verlopen, of de controle is niet beschikbaar. Vraag een nieuwe link aan vanuit het inlogscherm.",
                  "The recovery link is invalid or expired, or verification is unavailable. Request a new link from the sign-in page.",
                )}
              </p>
              <Button asChild>
                <Link to="/auth">{text("Naar inloggen", "Go to sign in")}</Link>
              </Button>
            </>
          )}
          {state === "done" && (
            <>
              <p>
                {text(
                  "Je wachtwoord is gewijzigd. Log opnieuw in met je nieuwe wachtwoord.",
                  "Your password has been changed. Sign in again with your new password.",
                )}
              </p>
              <Button asChild>
                <Link to="/auth">{text("Inloggen", "Sign in")}</Link>
              </Button>
            </>
          )}
          {state === "ready" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="recovery-password">
                  {text("Nieuw wachtwoord", "New password")}
                </Label>
                <Input
                  id="recovery-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-repeat">
                  {text("Herhaal wachtwoord", "Repeat password")}
                </Label>
                <Input
                  id="recovery-repeat"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? text("Opslaan…", "Saving…")
                  : text("Nieuw wachtwoord opslaan", "Save new password")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
