import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { BellRing, CheckCircle2, CircleX } from "lucide-react";
import { useEffect } from "react";
import { managePublicTripFollow } from "@/lib/public-trip-follow.functions";
import { useLocale } from "@/lib/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reis-volgen")({
  validateSearch: (search: Record<string, unknown>) => ({
    actie: search.actie === "afmelden" ? "afmelden" as const : "bevestigen" as const,
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Reisupdates beheren — GlobeTrotr" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: FollowPage,
});

function FollowPage() {
  const { text } = useLocale();
  const { actie, token } = Route.useSearch();
  const mutation = useMutation({ mutationFn: () => managePublicTripFollow({ data: { token, action: actie === "afmelden" ? "unsubscribe" : "confirm" } }) });
  const validToken = /^[0-9a-f]{64}$/i.test(token);
  useEffect(() => { mutation.reset(); if (validToken) mutation.mutate(); }, [token, actie]); // eslint-disable-line react-hooks/exhaustive-deps
  const success = validToken && (mutation.data?.status === "confirmed" || mutation.data?.status === "unsubscribed");
  const pending = validToken && (mutation.isIdle || mutation.isPending);
  return <Card className="surface mx-auto max-w-xl"><CardContent className="space-y-5 p-7 text-center sm:p-10">
    <div className={`mx-auto grid size-14 place-items-center rounded-2xl ${success ? "bg-emerald-500/10 text-emerald-600" : mutation.isError || mutation.data?.status === "invalid" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
      {success ? <CheckCircle2 className="size-7" /> : mutation.isError || mutation.data?.status === "invalid" ? <CircleX className="size-7" /> : <BellRing className="size-7" />}
    </div>
    <div><h1 className="font-display text-3xl font-semibold">{pending ? text("Voorkeur verwerken…", "Updating preference…") : mutation.isError ? text("Je voorkeur kon niet worden verwerkt", "Your preference could not be processed") : !validToken ? text("Deze link is niet meer geldig", "This link is no longer valid") : mutation.data?.status === "confirmed" ? text("Je volgt deze reis", "You are following this trip") : mutation.data?.status === "unsubscribed" ? text("Je bent afgemeld", "You have unsubscribed") : text("Deze link is niet meer geldig", "This link is no longer valid")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{mutation.isError ? text("De verbinding is tijdelijk niet beschikbaar. Probeer dezelfde link opnieuw.", "The connection is temporarily unavailable. Try the same link again.") : !validToken ? text("Vraag via de openbare reispagina een nieuwe bevestigingsmail aan.", "Request a new confirmation email from the public trip page.") : mutation.data?.status === "confirmed" ? text("Je ontvangt alleen updates die de reiziger bewust verstuurt. Iedere mail bevat een afmeldlink.", "You will only receive updates deliberately sent by the traveller. Every email contains an unsubscribe link.") : mutation.data?.status === "unsubscribed" ? text("Er worden geen nieuwe reisupdates meer naar dit e-mailadres gestuurd.", "No more travel updates will be sent to this email address.") : !pending ? text("Vraag via de openbare reispagina een nieuwe bevestigingsmail aan.", "Request a new confirmation email from the public trip page.") : ""}</p></div>
    {mutation.isError && validToken && <Button type="button" disabled={pending} onClick={() => mutation.mutate()}>{text("Opnieuw proberen", "Try again")}</Button>}
    <Button asChild variant="outline"><Link to="/">{text("Naar de website", "Go to website")}</Link></Button>
  </CardContent></Card>;
}
