import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Server, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/locale";
import { getSelfHostedSalesState } from "@/lib/self-hosted.functions";
export const Route = createFileRoute("/self-hosted")({
  head: () => ({
    meta: [
      { title: "Self-Hosted Agency — GlobeTrotr" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});
function Page() {
  const { text } = useLocale(),
    state = useQuery({ queryKey: ["self-hosted-sales"], queryFn: () => getSelfHostedSalesState() });
  if (state.isLoading)
    return (
      <p className="p-10 text-center text-muted-foreground">
        {text("Beschikbaarheid controleren…", "Checking availability…")}
      </p>
    );
  if (!state.data?.enabled)
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <Badge variant="secondary">{text("In ontwikkeling", "In development")}</Badge>
        <h1 className="mt-5 font-display text-4xl font-semibold">GlobeTrotr Self-Hosted Agency</h1>
        <p className="mt-4 text-muted-foreground">
          {text(
            "Deze editie wordt voorbereid en is nog niet te koop. Neem contact op voor een toekomstige proefinstallatie.",
            "This edition is being prepared and is not for sale yet. Contact us about a future pilot installation.",
          )}
        </p>
        <Button asChild className="mt-7">
          <Link to="/contact">{text("Contact opnemen", "Contact us")}</Link>
        </Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header className="aurora rounded-[2rem] p-10 text-center">
        <Server className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 font-display text-5xl font-semibold">GlobeTrotr Self-Hosted Agency</h1>
        <p className="mx-auto mt-4 max-w-2xl">
          {text(
            "Draai een officiële GlobeTrotr Agency-installatie op je eigen infrastructuur, met updates, licentiebeheer en support vanuit GlobeTrotr.",
            "Run an official GlobeTrotr Agency installation on your own infrastructure, with updates, licensing and support from GlobeTrotr.",
          )}
        </p>
      </header>
      <section className="grid gap-5 md:grid-cols-2">
        {[
          [
            "Jaarlicentie",
            "Annual licence",
            "Updates en support zolang de licentie actief is.",
            "Updates and support while the licence is active.",
          ],
          [
            "Permanente hoofdversie",
            "Perpetual major version",
            "Blijf de gekochte hoofdversie gebruiken; onderhoud en volgende hoofdversies zijn apart.",
            "Keep using the purchased major version; maintenance and future major versions are separate.",
          ],
        ].map((x) => (
          <Card key={x[0]}>
            <CardHeader>
              <CardTitle>{text(x[0], x[1])}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{text(x[2], x[3])}</p>
              <Button asChild className="mt-6">
                <Link to="/contact">{text("Vraag een offerte", "Request a quote")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [Building2, "Eigen organisatie", "Your organisation"],
          [ShieldCheck, "Eigen dataomgeving", "Your data environment"],
          [Check, "Officiële updates", "Official updates"],
        ].map(([Icon, nl, en]: any) => (
          <Card key={nl}>
            <CardContent className="p-6">
              <Icon className="size-6 text-primary" />
              <strong className="mt-4 block">{text(nl, en)}</strong>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
