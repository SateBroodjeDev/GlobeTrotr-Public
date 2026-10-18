import { TravelPlayground } from "@/components/TravelPlayground";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookHeart,
  CheckCircle2,
  GitCompareArrows,
  MapPinned,
  Share2,
  UserRound,
  Users,
} from "lucide-react";
import { LandingDemo } from "@/components/LandingDemo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { portalUrl } from "@/lib/site-routing";
import { PublicPlanOverview } from "@/components/PublicPlanOverview";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Interactive product tour — GlobeTrotr" },
      {
        name: "description",
        content:
          "Follow a realistic GlobeTrotr trip from route and bookings to discoveries, journal and offline use.",
      },
      { property: "og:title", content: "Try the GlobeTrotr product tour" },
      {
        property: "og:description",
        content:
          "Explore a realistic trip from planning and comparison to memories and offline use.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/demo" }],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { text } = useLocale();
  const { user } = useAuth();
  return (
    <div className="marketing-page space-y-10 pb-8">
      <section className="marketing-hero mx-auto max-w-3xl py-6 text-center">
        <Badge>{text("Interactieve productrondleiding", "Interactive product tour")}</Badge>
        <h1 className="mt-5 font-display text-4xl font-semibold sm:text-5xl">
          {text(
            "Volg één reis van plannen tot terugkijken.",
            "Follow one trip from planning to remembering.",
          )}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {text(
            "Geen losse trucjes, maar een realistisch voorbeeld. Klik door route, boekingen, vergelijken, dagplanning, ontdekken, kosten, dagboek en offline gebruik.",
            "A realistic workflow instead of disconnected widgets. Explore routes, bookings, comparison, itinerary, discovery, expenses, journal and offline use.",
          )}
        </p>
      </section>
      <p className="mx-auto max-w-5xl rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {text(
          "Dit is een oefenomgeving met vaste voorbeeldgegevens. Afstanden, prijzen, beschikbaarheid en vluchtupdates zijn gesimuleerd; er worden geen echte boekingen, betalingen of offline downloads uitgevoerd. Je keuzes verdwijnen zodra je deze pagina verlaat.",
          "This is a practice environment with fixed sample data. Distances, prices, availability and flight updates are simulated; no real bookings, payments or offline downloads are made. Your choices are cleared when you leave this page.",
        )}
      </p>
      <TravelPlayground />
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            [
              MapPinned,
              text("1. Bouw de route", "1. Build the route"),
              text(
                "Wijzig een stop en bekijk hoe planning, ontbrekende nachten en kaart samenhangen.",
                "Change a stop and see how itinerary, missing nights and map connect.",
              ),
            ],
            [
              Users,
              text("2. Plan als groep", "2. Plan as a group"),
              text(
                "Bekijk rollen, taken, persoonlijke paklijsten en de gezamenlijke lijst.",
                "Explore roles, tasks, personal packing lists and the shared list.",
              ),
            ],
            [
              GitCompareArrows,
              text("3. Vergelijk en kies", "3. Compare and choose"),
              text(
                "Vergelijk verblijf, huurauto en activiteiten, bespreek kandidaten en stem.",
                "Compare stays, rental cars and activities, discuss candidates and vote.",
              ),
            ],
            [
              BookHeart,
              text("4. Reis en onthoud", "4. Travel and remember"),
              text(
                "Probeer Vandaag, offline gebruik en het reisdagboek met openbare terugblik.",
                "Try Today, offline use and the travel journal with its public story.",
              ),
            ],
          ].map(([Icon, title, body]) => (
            <Card key={String(title)} className="marketing-editorial-card">
              <CardContent className="p-5">
                <Icon className="size-6 text-primary" />
                <h2 className="mt-4 font-display text-lg font-semibold">{title as string}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body as string}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
          {text(
            "Tip: probeer meerdere keuzes. De demo laat direct zien wat een reisgenoot, planner en financieel beheerder ervaart.",
            "Tip: try several choices. The demo immediately shows what a traveller, planner and finance manager experience.",
          )}
        </p>
      </section>
      <LandingDemo expanded />
      <section className="mx-auto grid max-w-6xl gap-5 rounded-3xl border bg-muted/20 p-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <Badge variant="secondary">
            <UserRound className="mr-1 size-3.5" />
            {text("Delen blijft jouw keuze", "Sharing stays your choice")}
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-semibold">
            {text(
              "Van herinnering naar profiel en directe reislink",
              "From memory to profile and direct trip link",
            )}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text(
              "In het echte product kies je een profielnaam, biografie en bezochte landen. Alleen reizen en herinneringen die je bewust openbaar maakt verschijnen op je profiel. Een reisgenoot kan de directe openbare reislink delen; volgers bevestigen eerst per e-mail en kunnen zich in iedere update afmelden.",
              "In the real product you choose a username, biography and visited countries. Only trips and memories you deliberately make public appear on your profile. A trip member can share the direct public trip link; followers first confirm by email and can unsubscribe from every update.",
            )}
          </p>
        </div>
        <Card className="marketing-editorial-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10 font-display text-lg font-semibold text-primary">
                NS
              </span>
              <div>
                <p className="font-display text-xl font-semibold">
                  {text("Noor op reis", "Noor travelling")}
                </p>
                <p className="break-all text-sm text-muted-foreground">
                  portal.globetrotr.nl/users/noor-op-reis
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm">
              🇳🇱 NL · 🇸🇪 SE · 🇳🇴 NO · 🇫🇮 FI · {text("4 bezochte landen", "4 visited countries")}
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-semibold">
                  {text("Noordlichtavontuur", "Northern lights adventure")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {text("Openbare reis · zonder PIN", "Public trip · no PIN")}
                </p>
              </div>
              <Share2 className="size-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          text("Werkt direct in je browser", "Works directly in your browser"),
          text("Geen account nodig", "No account required"),
          text("NL en EN beschikbaar", "Available in NL and EN"),
          text("Niets wordt opgeslagen", "Nothing is saved"),
        ].map((item) => (
          <p key={item} className="flex items-center gap-2 rounded-xl border p-4 text-sm">
            <CheckCircle2 className="size-4 text-primary" />
            {item}
          </p>
        ))}
      </section>
      <div className="mx-auto max-w-6xl">
        <PublicPlanOverview compact />
      </div>
      <div className="text-center">
        <Button asChild size="lg">
          <a href={portalUrl(user ? "/dashboard" : "/register")}>
            {user
              ? text("Open mijn reizen", "Open my trips")
              : text("Plan mijn eerste reis", "Plan my first trip")}
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
