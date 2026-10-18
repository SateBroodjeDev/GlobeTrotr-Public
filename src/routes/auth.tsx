import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/lib/locale";
import { getPublicFeatureFlags } from "@/lib/corporate-governance.functions";
import { getMaintenanceState } from "@/lib/maintenance.functions";
import { KeyRound } from "lucide-react";
import type { Provider } from "@supabase/supabase-js";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { agencyHostLookup } from "@/lib/agency-domain";
import { getPublicAgencyHostBranding, publicAgencyLogoUrl } from "@/lib/agency-host-branding";
import { publicSiteUrl } from "@/lib/site-routing";
import { localizedAuthError } from "@/lib/auth-error";
import { getStaffSsoConfiguration } from "@/lib/staff-sso-public.functions";
import { staffLoginOptions, staffLoginVisible, STAFF_SSO_PROVIDER } from "@/lib/staff-sso";
import { getStaffSecurityStatus } from "@/lib/staff-security.functions";
import { staffLoginRequired } from "@/lib/staff-account-access";
import { recoveryCallback } from "@/lib/auth-email-flow";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeInternalRedirect(search["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Inloggen — beveiligde reisworkspace" },
      {
        name: "description",
        content:
          "Log in of maak een gratis account om je reizen, budgetten en bonnetjes in de cloud te bewaren.",
      },
      { property: "og:title", content: "Inloggen — beveiligde reisworkspace" },
      {
        property: "og:description",
        content: "Bewaar je reisplanning en uitgaven veilig in je eigen cloud-workspace.",
      },
    ],
  }),
  component: AuthPage,
});

export function AuthPage({ initialMode = "signin" }: { initialMode?: "signin" | "signup" } = {}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaProblem, setCaptchaProblem] = useState<"load" | "domain" | false>(false);
  const [sent, setSent] = useState(false);
  const [sentKind, setSentKind] = useState<"confirmation" | "recovery" | "magic">("confirmation");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [emailActionBusy, setEmailActionBusy] = useState<"recovery" | "magic" | null>(null);
  const [agencyRegistrationAction, setAgencyRegistrationAction] = useState<
    "email" | "google" | "discord" | null
  >(null);
  const [mfaFactorId, setMfaFactorId] = useState<string>();
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const { session, passwordRecovery } = useAuth();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const { text, language } = useLocale();
  const navigate = useNavigate();
  const [hostname] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hostname.toLowerCase(),
  );
  const agencyHostDetails = hostname ? agencyHostLookup(hostname) : null;
  const agencyHost = Boolean(agencyHostDetails);
  const customAgencyDomain = Boolean(agencyHostDetails?.customDomain);
  const staffSso = useQuery({
    queryKey: ["staff-sso-configuration"],
    queryFn: () => getStaffSsoConfiguration(),
    enabled: hostname === "portal.globetrotr.nl" && mode === "signin",
    retry: false,
  });
  const hostBranding = useQuery({
    queryKey: ["public-agency-host-branding", hostname],
    queryFn: () => getPublicAgencyHostBranding(hostname),
    enabled: agencyHost,
    retry: false,
  });
  const brandName = hostBranding.data?.brandName ?? (agencyHost ? "Agency portal" : "GlobeTrotr");
  const brandLogo = publicAgencyLogoUrl(hostBranding.data?.logoPath);
  const flags = useQuery({
    queryKey: ["public-feature-flags"],
    queryFn: () => getPublicFeatureFlags(),
    retry: false,
  });
  const maintenance = useQuery({
    queryKey: ["public-maintenance"],
    queryFn: () => getMaintenanceState(),
    retry: false,
  });
  const maintenanceLogin = maintenance.data?.active === true;
  const destination = maintenanceLogin ? "/corporate-admin" : redirect;
  const registrationEnabled = flags.data?.["public.registration"] !== false;
  const agencyTurnstilePending = Boolean(
    mode === "signup" &&
    customAgencyDomain &&
    !hostBranding.isLoading &&
    !hostBranding.data?.turnstileConfigured,
  );
  const captchaRequired = mode === "signup" && !agencyTurnstilePending;

  useEffect(() => {
    if ((!registrationEnabled || maintenanceLogin) && mode === "signup") setMode("signin");
  }, [registrationEnabled, maintenanceLogin, mode]);

  useEffect(() => {
    if (!session) return;
    if (
      passwordRecovery ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
    ) {
      void navigate({ to: "/reset-password", replace: true });
      return;
    }
    let active = true;
    void (async () => {
      if (maintenanceLogin && session.user.app_metadata?.corporate_admin !== true) {
        await supabase.auth.signOut();
        if (active)
          setFormError(
            text(
              "Dit account heeft geen toegang tot de beheerderslogin tijdens onderhoud.",
              "This account cannot use the administrator sign-in during maintenance.",
            ),
          );
        return;
      }
      let security;
      try {
        security = await getStaffSecurityStatus();
      } catch {
        if (active)
          setFormError(
            text(
              "De inlogcontrole is tijdelijk niet beschikbaar. Probeer opnieuw.",
              "The sign-in check is temporarily unavailable. Please retry.",
            ),
          );
        return;
      }
      if (!active) return;
      if (staffLoginRequired(security)) {
        await navigate({
          to: "/team-login",
          search: { redirect: destination || "/dashboard" },
          replace: true,
        });
        return;
      }
      if (security.isStaff && security.enforced && security.verifiedSession) {
        window.location.replace(destination || "/dashboard");
        return;
      }
      const { data: levels } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (levels?.nextLevel === "aal2" && levels.currentLevel !== "aal2") {
        const { data } = await supabase.auth.mfa.listFactors();
        const factor = data?.totp?.find((item) => item.status === "verified");
        if (factor) {
          setMfaFactorId(factor.id);
          return;
        }
      }
      if (destination) window.location.replace(destination);
      else navigate({ to: "/dashboard", replace: true });
    })();
    return () => {
      active = false;
    };
  }, [session, passwordRecovery, navigate, destination, maintenanceLogin, text]);

  async function verifyMfa() {
    if (!mfaFactorId) return;
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.replace(/\s/g, ""),
      });
      if (error) throw error;
      if (destination) window.location.replace(destination);
      else navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("De verificatiecode is niet geldig.", "The verification code is invalid."),
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function authenticateWithEmail() {
    setFormError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const signup = supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination ?? ""}`,
            data: { full_name: name, language },
            captchaToken,
          },
        });
        const { data, error } = await Promise.race([
          signup,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("SIGNUP_TIMEOUT")), 60000),
          ),
        ]);
        if (error) throw error;
        if (!data.session) {
          setSentKind("confirmation");
          setSent(true);
          toast.success(
            text(
              "Check je mail om je account te bevestigen.",
              "Check your email to confirm your account.",
            ),
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(text("Welkom terug!", "Welcome back!"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const localizedMessage = localizedAuthError(message, language);
      setFormError(
        message === "SIGNUP_TIMEOUT"
          ? text(
              "De registratieserver antwoordt niet op tijd. Wacht één minuut en controleer je e-mail. Ontvang je niets, dan is het account niet afgerond en kun je opnieuw proberen.",
              "The registration server did not respond in time. Wait one minute and check your email. If nothing arrives, the account was not completed and you can try again.",
            )
          : localizedMessage || text("Registreren is mislukt.", "Registration failed."),
      );
      if (mode === "signup") {
        setCaptchaToken("");
        setCaptchaReset((value) => value + 1);
      }
      if (message !== "SIGNUP_TIMEOUT")
        toast.error(
          /user is banned/i.test(message)
            ? text(
                "Dit account is tijdelijk geblokkeerd. Neem contact op via info@globetrotr.nl als je denkt dat dit niet klopt.",
                "This account is temporarily blocked. Contact info@globetrotr.nl if you believe this is incorrect.",
              )
            : localizedMessage || text("Er ging iets mis", "Something went wrong"),
        );
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (agencyTurnstilePending) return;
    if (captchaRequired && !captchaToken) {
      setFormError(text("Rond eerst de spamcontrole af.", "Complete the spam check first."));
      return;
    }
    if (mode === "signup" && agencyHost) {
      setAgencyRegistrationAction("email");
      return;
    }
    await authenticateWithEmail();
  }

  async function signInWithPasskey() {
    setPasskeyBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Inloggen met passkey is mislukt.", "Passkey sign-in failed."),
      );
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function signInWithProvider(provider: "google" | "discord", agencyConfirmed = false) {
    if (mode === "signup" && agencyHost && !agencyConfirmed) {
      setAgencyRegistrationAction(provider);
      return;
    }
    setOauthBusy(provider);
    try {
      const callback = new URL("/oauth-callback", window.location.origin);
      if (destination) callback.searchParams.set("next", destination);
      callback.searchParams.set("language", language);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });
      if (error) throw error;
    } catch (error) {
      setOauthBusy(null);
      toast.error(
        error instanceof Error
          ? error.message
          : text("Inloggen via deze aanbieder is mislukt.", "Sign-in with this provider failed."),
      );
    }
  }

  async function signInWithStaff() {
    if (!staffLoginVisible(staffSso.data?.enabled === true, hostname, mode, maintenanceLogin))
      return;
    setOauthBusy(STAFF_SSO_PROVIDER);
    try {
      const { error } = await supabase.auth.signInWithOAuth(
        staffLoginOptions(destination, language),
      );
      if (error) throw error;
    } catch {
      setOauthBusy(null);
      toast.error(
        text(
          "Teamlogin is niet beschikbaar. Probeer opnieuw of neem contact op met je beheerder.",
          "Team sign-in is unavailable. Try again or contact your administrator.",
        ),
      );
    }
  }

  function continueAgencyRegistration() {
    const action = agencyRegistrationAction;
    setAgencyRegistrationAction(null);
    if (action === "email") void authenticateWithEmail();
    else if (action) void signInWithProvider(action, true);
  }

  async function sendEmailAction(action: "recovery" | "magic") {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.error(
        text("Vul eerst een geldig e-mailadres in.", "Enter a valid email address first."),
      );
      return;
    }
    setEmailActionBusy(action);
    try {
      const callback = new URL("/auth", window.location.origin);
      if (destination) callback.searchParams.set("redirect", destination);
      const result =
        action === "recovery"
          ? await supabase.auth.resetPasswordForEmail(normalized, {
              redirectTo: recoveryCallback(window.location.origin),
            })
          : await supabase.auth.signInWithOtp({
              email: normalized,
              options: {
                emailRedirectTo: callback.toString(),
                shouldCreateUser: registrationEnabled,
                data: { language },
              },
            });
      if (result.error) throw result.error;
      setEmail(normalized);
      setSentKind(action);
      setSent(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("De e-mail kon niet worden aangevraagd.", "The email could not be requested."),
      );
    } finally {
      setEmailActionBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          {agencyHost && (
            <div className="mb-3 flex items-center gap-3">
              {brandLogo && (
                <img
                  src={brandLogo}
                  alt={`${brandName} logo`}
                  className="size-12 rounded-xl object-contain"
                />
              )}
              <div>
                <p className="font-display text-xl font-semibold">{brandName}</p>
                {hostBranding.data?.tagline && (
                  <p className="text-sm text-muted-foreground">{hostBranding.data.tagline}</p>
                )}
              </div>
            </div>
          )}
          <CardTitle className="font-display text-2xl">
            {mode === "signin"
              ? text("Inloggen", "Sign in")
              : text("Account aanmaken", "Create account")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {text(
              "Je reizen, uitgaven en bonnetjes worden veilig in je eigen workspace bewaard.",
              "Your trips, expenses and receipts are stored securely in your own workspace.",
            )}
          </p>
        </CardHeader>
        <CardContent>
          {mfaFactorId ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-medium">
                  {text("Tweestapsverificatie", "Two-step verification")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {text(
                    "Voer de zescijferige code uit je authenticator-app in.",
                    "Enter the six-digit code from your authenticator app.",
                  )}
                </p>
              </div>
              <Label htmlFor="login-totp">{text("Verificatiecode", "Verification code")}</Label>
              <Input
                id="login-totp"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void verifyMfa();
                }}
              />
              <Button
                className="w-full"
                disabled={mfaBusy || mfaCode.replace(/\s/g, "").length !== 6}
                onClick={() => void verifyMfa()}
              >
                {mfaBusy
                  ? text("Controleren…", "Verifying…")
                  : text("Veilig inloggen", "Sign in securely")}
              </Button>
            </div>
          ) : sent ? (
            <div className="space-y-4 text-sm">
              <p>
                {text(
                  sentKind === "recovery"
                    ? "Als dit account bestaat, hebben we een herstelmail gestuurd naar"
                    : sentKind === "magic"
                      ? "We hebben een veilige inloglink gestuurd naar"
                      : "We hebben een bevestigingsmail gestuurd naar",
                  sentKind === "recovery"
                    ? "If this account exists, we sent a recovery email to"
                    : sentKind === "magic"
                      ? "We sent a secure sign-in link to"
                      : "We sent a confirmation email to",
                )}{" "}
                <strong>{email}</strong>.{" "}
                {text(
                  sentKind === "recovery"
                    ? "Open de link om een nieuw wachtwoord te kiezen."
                    : sentKind === "magic"
                      ? `De link kan een keer worden gebruikt en brengt je veilig terug naar ${brandName}.`
                      : redirect
                        ? "Klik op de link om je account te bevestigen. Daarna kom je terug bij de uitnodiging."
                        : "Klik op de link om je workspace te activeren.",
                  sentKind === "recovery"
                    ? "Open the link to choose a new password."
                    : sentKind === "magic"
                      ? `The link can be used once and safely returns you to ${brandName}.`
                      : redirect
                        ? "Follow the link to confirm your account. You will then return to the invitation."
                        : "Follow the link to activate your workspace.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setSent(false)}
              >
                {text("Terug naar inloggen", "Back to sign in")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceLogin && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">
                    {text("Beveiligde beheerderslogin", "Secure administrator sign-in")}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {text(
                      "Tijdens onderhoud zijn registratie, sociale login en inloglinks uitgeschakeld. Gebruik het bestaande beheerdersaccount met wachtwoord of passkey.",
                      "During maintenance, registration, social sign-in and magic links are disabled. Use the existing administrator account with a password or passkey.",
                    )}
                  </p>
                </div>
              )}
              {!maintenance.isLoading && !maintenanceLogin && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["google", "discord"] as const).map((provider) => (
                      <Button
                        key={provider}
                        type="button"
                        variant="outline"
                        className="w-full capitalize"
                        disabled={Boolean(oauthBusy) || agencyTurnstilePending}
                        onClick={() => void signInWithProvider(provider)}
                      >
                        <ProviderIcon provider={provider} />
                        {oauthBusy === provider ? text("Openen…", "Opening…") : provider}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span>{text("of met e-mail", "or with email")}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              {!maintenance.isLoading &&
                staffLoginVisible(
                  staffSso.data?.enabled === true,
                  hostname,
                  mode,
                  maintenanceLogin,
                ) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={Boolean(oauthBusy) || busy || passkeyBusy}
                    onClick={() => void signInWithStaff()}
                  >
                    <KeyRound className="h-4 w-4" />
                    {oauthBusy === STAFF_SSO_PROVIDER
                      ? text("Openen…", "Opening…")
                      : text("Teamlogin", "Team sign-in")}
                  </Button>
                )}
              <form onSubmit={submit} className="space-y-4">
                {captchaRequired && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{text("Naam", "Name")}</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{text("Wachtwoord", "Password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {mode === "signup" && (
                  <AuthCaptcha
                    onToken={setCaptchaToken}
                    reset={captchaReset}
                    onProblem={setCaptchaProblem}
                  />
                )}
                {captchaRequired && captchaProblem && (
                  <p role="alert" className="text-sm text-destructive">
                    {captchaProblem === "domain"
                      ? text(
                          `De spamcontrole is nog niet geactiveerd voor ${hostname}. De beheerder moet het hoofddomein toevoegen aan Cloudflare Turnstile Hostname Management.`,
                          `The spam check is not activated for ${hostname} yet. The administrator must add the root domain to Cloudflare Turnstile Hostname Management.`,
                        )
                      : text(
                          "De spamcontrole laadt niet. Controleer je verbinding of advertentieblokkering en probeer opnieuw.",
                          "The spam check did not load. Check your connection or ad blocker and retry.",
                        )}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        if (!window.turnstile)
                          document.querySelector("script[data-turnstile]")?.remove();
                        setCaptchaReset((value) => value + 1);
                      }}
                    >
                      {text("Opnieuw laden", "Retry")}
                    </button>
                  </p>
                )}
                {agencyTurnstilePending && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    {text(
                      `Zelf registreren op ${hostname} wordt binnenkort geactiveerd. Vraag ${brandName} om een uitnodiging of log in met een bestaand account.`,
                      `Self-registration on ${hostname} will be activated soon. Ask ${brandName} for an invitation or sign in with an existing account.`,
                    )}
                  </p>
                )}
                {formError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {formError}
                  </p>
                )}
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">
                    {text(
                      "Gebruik je dit e-mailadres al via Google of Discord? Log dan in met die aanbieder. Om te voorkomen dat anderen accounts kunnen opzoeken, bevestigen we hier niet of een adres al bestaat.",
                      "Already using this email through Google or Discord? Sign in with that provider. To prevent account enumeration, we do not confirm here whether an address already exists.",
                    )}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || agencyTurnstilePending || maintenance.isLoading}
                >
                  {busy
                    ? text("Bezig…", "Working…")
                    : mode === "signin"
                      ? text("Inloggen", "Sign in")
                      : text("Account aanmaken", "Create account")}
                </Button>
                {mode === "signin" && !customAgencyDomain && (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      <span>{text("of", "or")}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={passkeyBusy}
                      onClick={() => void signInWithPasskey()}
                    >
                      <KeyRound className="size-4" />
                      {passkeyBusy
                        ? text("Passkey openen…", "Opening passkey…")
                        : text("Inloggen met passkey", "Sign in with passkey")}
                    </Button>
                  </>
                )}
              </form>
              {mode === "signin" && !maintenanceLogin && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-10 whitespace-normal text-xs"
                    disabled={Boolean(emailActionBusy)}
                    onClick={() => void sendEmailAction("recovery")}
                  >
                    {emailActionBusy === "recovery"
                      ? text("Versturen...", "Sending...")
                      : text("Wachtwoord vergeten?", "Forgot password?")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-10 whitespace-normal text-xs"
                    disabled={Boolean(emailActionBusy)}
                    onClick={() => void sendEmailAction("magic")}
                  >
                    {emailActionBusy === "magic"
                      ? text("Versturen...", "Sending...")
                      : text("Inloglink per e-mail", "Email me a sign-in link")}
                  </Button>
                </div>
              )}
              <p className="text-center text-xs leading-5 text-muted-foreground">
                {text(
                  "Door verder te gaan ga je akkoord met de voorwaarden. De privacyverklaring legt uit hoe we je gegevens gebruiken; dit is geen toestemming voor tracking.",
                  "By continuing, you agree to the terms. The privacy notice explains how we use your data; this does not give consent to tracking.",
                )}{" "}
                <a href={publicSiteUrl("/terms")} className="underline underline-offset-2">
                  {text("Voorwaarden", "Terms")}
                </a>{" "}
                ·{" "}
                <a href={publicSiteUrl("/privacy")} className="underline underline-offset-2">
                  Privacy
                </a>
              </p>
            </div>
          )}

          {!maintenanceLogin &&
            (registrationEnabled ? (
              <button
                type="button"
                onClick={() => void navigate({ to: mode === "signin" ? "/register" : "/auth" })}
                className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {mode === "signin"
                  ? text(
                      "Nog geen account? Registreer gratis",
                      "No account yet? Create one for free",
                    )
                  : text("Al een account? Log in", "Already have an account? Sign in")}
              </button>
            ) : (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {text(
                  "Nieuwe registraties zijn tijdelijk gepauzeerd. Bestaande gebruikers kunnen gewoon inloggen.",
                  "New registrations are temporarily paused. Existing users can still sign in.",
                )}
              </p>
            ))}
        </CardContent>
      </Card>
      <AlertDialog
        open={agencyRegistrationAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy && !oauthBusy) setAgencyRegistrationAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {text(`Account maken voor ${brandName}`, `Create an account for ${brandName}`)}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                {text(
                  `${brandName} gebruikt GlobeTrotr als beveiligd reisplatform. Je maakt nu een GlobeTrotr-account aan waarmee je toegang krijgt tot de omgeving van ${brandName}.`,
                  `${brandName} uses GlobeTrotr as its secure travel platform. You are now creating a GlobeTrotr account that gives you access to ${brandName}'s environment.`,
                )}
              </span>
              <span className="block">
                {text(
                  "Op het account zijn de algemene voorwaarden en privacyverklaring van GlobeTrotr van toepassing. De reisorganisatie kan daarnaast eigen afspraken met je hebben.",
                  "The GlobeTrotr terms and privacy policy apply to the account. The travel organisation may also have its own agreements with you.",
                )}
              </span>
              <span className="block">
                <a
                  href={publicSiteUrl("/terms")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {text("Algemene voorwaarden", "Terms and conditions")}
                </a>{" "}
                ·{" "}
                <a
                  href={publicSiteUrl("/privacy")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {text("Privacyverklaring", "Privacy policy")}
                </a>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text("Terug", "Go back")}</AlertDialogCancel>
            <AlertDialogAction onClick={continueAgencyRegistration}>
              {text("Akkoord en account aanmaken", "Accept and create account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AuthCaptcha({
  onToken,
  reset,
  onProblem,
}: {
  onToken: (token: string) => void;
  reset: number;
  onProblem: (problem: "load" | "domain" | false) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const receive = useCallback((value: string) => onToken(value), [onToken]);
  useEffect(() => {
    let widget = "";
    let cancelled = false;
    let attempts = 0;
    onProblem(false);
    const render = () => {
      if (cancelled) return;
      if (ref.current && window.turnstile && !ref.current.childElementCount) {
        widget = window.turnstile.render(ref.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAEzAUfhMofYpNxJC",
          theme: "auto",
          callback: receive,
          "expired-callback": () => receive(""),
          action: "signup",
          "error-callback": (code: string | number) => {
            receive("");
            onProblem(String(code).startsWith("110200") ? "domain" : "load");
            return true;
          },
        });
        onProblem(false);
      }
    };
    const old = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (old) {
      render();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      document.head.appendChild(script);
    }
    const retry = window.setInterval(() => {
      if (window.turnstile) {
        render();
        window.clearInterval(retry);
      } else if (++attempts >= 15) {
        onProblem("load");
        window.clearInterval(retry);
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(retry);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [receive, reset, onProblem]);
  return <div ref={ref} className="min-h-[65px]" aria-label="Spamcontrole" />;
}

function ProviderIcon({ provider }: { provider: "google" | "discord" }) {
  return provider === "google" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.5 14Z" />
      <path
        fill="#EA4335"
        d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6Z"
      />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-[#5865F2]">
      <path d="M19.5 5.3A18 18 0 0 0 15 4l-.6 1.2a16 16 0 0 0-4.8 0L9 4a18 18 0 0 0-4.5 1.3C1.7 9.5.9 13.6 1.3 17.6A18 18 0 0 0 6.8 20l1.3-1.8-1.8-.9.4-.3c3.5 1.6 7.2 1.6 10.6 0l.5.3-1.9.9 1.3 1.8a18 18 0 0 0 5.5-2.4c.5-4.7-.8-8.8-3.2-12.3ZM8.3 15.1c-1 0-1.9-1-1.9-2.2s.9-2.2 1.9-2.2 1.9 1 1.9 2.2-.9 2.2-1.9 2.2Zm7.4 0c-1 0-1.9-1-1.9-2.2s.9-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z" />
    </svg>
  );
}
