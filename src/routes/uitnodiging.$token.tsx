import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, Clock3, LogIn, Mail, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTripInvitation, respondToTripInvitation } from "@/lib/invitation.functions";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import type { TripMemberRole } from "@/lib/types";

export const Route = createFileRoute("/uitnodiging/$token")({ component: InvitationPage });

export function InvitationPage() {
  const { token } = useParams({ strict: false }) as { token: string };
  const { user } = useAuth();
  const { text } = useLocale();
  const [responding, setResponding] = useState(false);
  const query = useQuery({
    queryKey: ["trip-invitation", token],
    queryFn: () => getTripInvitation({ data: { token } }),
    retry: false,
  });
  const invitation = query.data;
  const returnPath = `/invite/${token}`;

  async function respond(response: "accept" | "decline") {
    setResponding(true);
    try {
      const result = await respondToTripInvitation({ data: { token, response } });
      if (result.status === "accepted" || result.status === "already_member") {
        toast.success(
          result.status === "already_member"
            ? text("Je neemt al deel aan deze reis.", "You already participate in this trip.")
            : text("Uitnodiging geaccepteerd.", "Invitation accepted."),
        );
        window.location.assign("/dashboard");
        return;
      }
      if (result.status === "declined") {
        toast.success(text("Uitnodiging geweigerd.", "Invitation declined."));
        await query.refetch();
        return;
      }
      toast.error(responseMessage(result.status, text));
      await query.refetch();
    } catch (error) {
      toast.error(invitationErrorMessage(error, text));
    } finally {
      setResponding(false);
    }
  }

  if (query.isLoading)
    return (
      <InvitationCard>
        <p className="text-sm text-muted-foreground">
          {text("Uitnodiging laden…", "Loading invitation…")}
        </p>
      </InvitationCard>
    );
  if (!invitation || invitation.status === "invalid")
    return (
      <InvitationCard>
        <State
          title={text("Ongeldige uitnodiging", "Invalid invitation")}
          body={text(
            "Deze uitnodigingslink bestaat niet of is ongeldig.",
            "This invitation link does not exist or is invalid.",
          )}
        />
      </InvitationCard>
    );
  if (invitation.status !== "pending")
    return (
      <InvitationCard>
        <State
          title={statusTitle(invitation.status, text)}
          body={responseMessage(invitation.status, text)}
        />
      </InvitationCard>
    );

  return (
    <InvitationCard>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          <Mail className="mr-1 size-3" />
          {text("Reisuitnodiging", "Trip invitation")}
        </Badge>
      </div>
      <h1 className="mt-5 font-display text-3xl font-semibold">{invitation.tripName}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {text(
          "Je bent uitgenodigd om aan deze reis deel te nemen als",
          "You have been invited to join this trip as",
        )}{" "}
        <strong className="text-foreground">{roleLabel(invitation.role, text)}</strong>.
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-4" />
        {text("Geldig tot", "Valid until")}{" "}
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(invitation.expiresAt),
        )}
      </p>
      {user ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button disabled={responding} onClick={() => void respond("accept")}>
            <Check className="size-4" />
            {text("Accepteren", "Accept")}
          </Button>
          <Button variant="outline" disabled={responding} onClick={() => void respond("decline")}>
            <X className="size-4" />
            {text("Weigeren", "Decline")}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <Button className="w-full" asChild>
            <Link to="/auth" search={{ redirect: returnPath }}>
              <LogIn className="size-4" />
              {text("Inloggen of account maken", "Sign in or create account")}
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {text(
              "Na het inloggen kom je automatisch terug om zelf te accepteren of te weigeren.",
              "After signing in, you will return automatically to accept or decline.",
            )}
          </p>
        </div>
      )}
    </InvitationCard>
  );
}

function InvitationCard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="surface">
        <CardHeader>
          <CardTitle>GlobeTrotr</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
function State({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <Button className="mt-6" asChild variant="outline">
        <Link to="/">GlobeTrotr</Link>
      </Button>
    </div>
  );
}
function roleLabel(role: TripMemberRole, text: (nl: string, en: string) => string) {
  return {
    traveler: text("medereiziger", "traveller"),
    viewer: text("kijker", "viewer"),
    advisor: text("reisadviseur", "travel advisor"),
    finance: text("financieel beheerder", "finance manager"),
    client: text("klant/reiziger", "client/traveller"),
    owner: text("eigenaar", "owner"),
  }[role];
}
function statusTitle(status: string, text: (nl: string, en: string) => string) {
  return (
    (
      {
        accepted: text("Uitnodiging geaccepteerd", "Invitation accepted"),
        declined: text("Uitnodiging geweigerd", "Invitation declined"),
        expired: text("Uitnodiging verlopen", "Invitation expired"),
        revoked: text("Uitnodiging ingetrokken", "Invitation revoked"),
      } as Record<string, string>
    )[status] ?? text("Uitnodiging niet beschikbaar", "Invitation unavailable")
  );
}
function responseMessage(status: string, text: (nl: string, en: string) => string) {
  return (
    (
      {
        accepted: text(
          "Je hebt deze uitnodiging al geaccepteerd.",
          "You have already accepted this invitation.",
        ),
        declined: text("Je hebt deze uitnodiging geweigerd.", "You declined this invitation."),
        expired: text(
          "Deze uitnodiging is verlopen. Vraag de eigenaar om een nieuwe link.",
          "This invitation has expired. Ask the owner for a new link.",
        ),
        revoked: text(
          "De eigenaar heeft deze uitnodiging ingetrokken.",
          "The owner revoked this invitation.",
        ),
        forbidden: text(
          "Deze uitnodiging hoort bij een ander e-mailadres. Log in met het uitgenodigde account.",
          "This invitation belongs to another email address. Sign in with the invited account.",
        ),
        invalid: text("Deze uitnodiging is ongeldig.", "This invitation is invalid."),
      } as Record<string, string>
    )[status] ??
    text("De uitnodiging kon niet worden verwerkt.", "The invitation could not be processed.")
  );
}
function invitationErrorMessage(error: unknown, text: (nl: string, en: string) => string) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("rpc-unavailable"))
    return text(
      "De uitnodigingsfunctie is nog niet beschikbaar in de database-API. Vernieuw de pagina over een minuut en probeer opnieuw.",
      "The invitation function is not available in the database API yet. Refresh the page in a minute and try again.",
    );
  if (message.includes("membership-conflict"))
    return text(
      "Dit account heeft al een conflicterende deelname aan deze reis. Neem contact op met de reisbeheerder.",
      "This account already has a conflicting membership for this trip. Contact the trip manager.",
    );
  return text(
    "Je antwoord kon niet worden opgeslagen. Foutreferentie: invitation-response.",
    "Your response could not be saved. Error reference: invitation-response.",
  );
}
