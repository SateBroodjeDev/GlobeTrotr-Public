import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getOwnStaffSetup, beginOwnStaffMailSetup } from "@/lib/staff-mail-setup.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { mailSetupPhase, type MailSetupPhase } from "@/lib/staff-mail-setup-diagnostics";

export const Route = createFileRoute("/_authenticated/team-setup")({ component: TeamSetup });
function TeamSetup() {
  const { text } = useLocale();
  const attempted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failurePhase, setFailurePhase] = useState<MailSetupPhase>();
  const query = useQuery({
    queryKey: ["own-staff-setup"],
    queryFn: () => getOwnStaffSetup(),
    refetchInterval: 5000,
  });
  const state = query.data;
  const needsMail = Boolean(
    state?.managed &&
    state.enabled &&
    state.mailAllowed &&
    state.identity === "ready" &&
    state.mailbox?.active &&
    state.mailbox.status === "ready" &&
    !state.mailbox.connected,
  );
  async function connect() {
    setBusy(true);
    setFailed(false);
    setFailurePhase(undefined);
    try {
      const result = await beginOwnStaffMailSetup();
      window.location.assign(result.url);
    } catch {
      setFailed(true);
      setFailurePhase("begin");
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!needsMail || attempted.current) return;
    attempted.current = true;
    if (new URLSearchParams(window.location.search).get("mail") === "failed") {
      setFailed(true);
      setFailurePhase(mailSetupPhase(new URLSearchParams(window.location.search).get("phase")));
      return;
    }
    void connect();
  }, [needsMail]);
  const waiting = Boolean(
    state?.managed &&
    (["pending", "processing"].includes(state.identity || "") ||
      (state.mailbox && ["pending", "provisioning"].includes(state.mailbox.status))),
  );
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="font-display text-2xl font-semibold">
        {text("Je GlobeTrotr-teamaccount", "Your GlobeTrotr team account")}
      </h1>
      <p className="text-muted-foreground">
        {text(
          "We maken je werkplek klaar. Je persoonlijke GlobeTrotr-account blijft behouden.",
          "We are preparing your workspace. Your personal GlobeTrotr account is preserved.",
        )}
      </p>
      {query.isPending && <Loader2 className="size-6 animate-spin" />}
      {query.isError && (
        <p role="alert">
          {text(
            "De inrichting kan nu niet worden gecontroleerd. Probeer opnieuw.",
            "Setup cannot be checked right now. Please retry.",
          )}
        </p>
      )}
      {state && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            {text("Teamlogin bevestigd", "Team sign-in verified")}
          </p>
          {state.mailbox && (
            <p>
              {text("Persoonlijke mailbox", "Personal mailbox")}:{" "}
              <strong>{state.mailbox.address}</strong>
            </p>
          )}
          {waiting && (
            <p className="flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" />
              {text("Account en mailbox worden ingericht…", "Preparing your account and mailbox…")}
            </p>
          )}
          {busy && <p>{text("Mailtoegang wordt verbonden…", "Connecting mail access…")}</p>}
          {state.mailbox?.connected && (
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              {text("Mailtoegang verbonden", "Mail access connected")}
            </p>
          )}
          {state.mailbox?.connected && !state.mailbox.lastSyncedAt && (
            <p>
              {text(
                "De eerste mailboxsynchronisatie wordt uitgevoerd.",
                "The first mailbox sync is running.",
              )}
            </p>
          )}
          {state.mailbox?.lastSyncedAt && !state.mailbox?.syncError && (
            <p>{text("Mailboxsynchronisatie geslaagd", "Mailbox sync succeeded")}</p>
          )}
          {(failed ||
            state.identityError ||
            state.mailbox?.syncError ||
            state.mailbox?.provisioningError) && (
            <p role="alert" className="text-destructive">
              {text(
                "De inrichting is nog niet afgerond. Probeer opnieuw of neem contact op met je beheerder.",
                "Setup is not complete yet. Retry or contact your administrator.",
              )}
            </p>
          )}
          {failed && needsMail && (
            <Button disabled={busy} onClick={() => void connect()}>
              {text("Mailtoegang opnieuw verbinden", "Reconnect mail access")}
            </Button>
          )}
          {failed && failurePhase && (
            <p className="text-sm text-muted-foreground">
              {text("Controlecode", "Support code")}: {failurePhase}
            </p>
          )}
          {state.mailbox && state.managed && !state.enabled && (
            <p>
              {text(
                "Je beheerder moet de automatische mailboxsetup nog activeren.",
                "Your administrator still needs to enable automatic mailbox setup.",
              )}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/corporate-admin">{text("Open GlobeTrotr", "Open GlobeTrotr")}</Link>
        </Button>
        {state?.mailAllowed && (
          <Button asChild variant="outline">
            <Link to="/corporate-admin/mail">{text("Open bedrijfsmail", "Open company mail")}</Link>
          </Button>
        )}
        {state?.mailbox?.connected && (
          <Button asChild variant="outline">
            <a href="https://mail.globetrotr.nl/account/">
              {text("Mailaccount beheren", "Manage mail account")}
            </a>
          </Button>
        )}
      </div>
    </main>
  );
}
