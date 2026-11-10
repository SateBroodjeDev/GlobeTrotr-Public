import { MarketingLink as Link } from "@/components/MarketingLink";
import { ArrowRight, BriefcaseBusiness, Check, Plane, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS } from "@/lib/plans";
import { useLocale } from "@/lib/locale";

const DETAILS = {
  free: {
    icon: Plane,
    audience: ["Voor eigen reizen, alleen of samen", "For your own trips, solo or together"],
    features: [
      ["Twee actieve reizen", "Two active trips"],
      ["Samen plannen en kosten verdelen", "Plan together and split expenses"],
      ["Dagboek, openbaar profiel en reisverhaal", "Journal, public profile and travel story"],
    ],
  },
  pro: {
    icon: Users,
    audience: ["Meer ruimte voor jouw reizen", "More room for your trips"],
    features: [
      ["Onbeperkt actieve reizen", "Unlimited active trips"],
      ["Live weer en ruimere providerlimieten", "Live weather and higher provider limits"],
      ["PDF-declaraties", "PDF expense reports"],
    ],
  },
  agency: {
    icon: BriefcaseBusiness,
    audience: [
      "Voor klantreizen en professioneel beheer",
      "For client trips and professional management",
    ],
    features: [
      ["Alle Pro-reisfuncties", "All Pro trip features"],
      [
        "Klanten, offertes, facturen, teamrechten en taken",
        "Clients, quotes, invoices, team permissions and tasks",
      ],
      [
        "Eigen merk, domein en zakelijke communicatie",
        "Custom brand, domain and business communication",
      ],
    ],
  },
} as const;

export function PublicPlanOverview({
  compact = false,
  audience = "all",
  layout = "grouped",
}: {
  compact?: boolean;
  audience?: "all" | "travelers" | "agency";
  layout?: "grouped" | "cards";
}) {
  const { text } = useLocale();
  const cards = layout === "cards";
  const groups = cards
    ? (["all"] as const)
    : audience === "all"
      ? (["travelers", "agency"] as const)
      : [audience];
  return (
    <div className="space-y-10">
      {groups.map((group) => {
        const agency = group === "agency";
        const plans = PLANS.filter(
          (plan) => cards || (agency ? plan.id === "agency" : plan.id !== "agency"),
        );
        const actions = !cards && (
          <div
            className={
              compact
                ? "mt-6 flex flex-wrap gap-3"
                : "flex flex-col justify-center gap-3 sm:flex-row"
            }
          >
            <Button asChild>
              <Link to="/pricing" hash={agency ? "agency" : "travelers"}>
                {agency
                  ? text("Bekijk het Agency-abonnement", "View the Agency plan")
                  : text("Vergelijk Free en Pro", "Compare Free and Pro")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={agency ? "/contact" : "/demo"}>
                {agency
                  ? text("Bespreek jouw organisatie", "Discuss your organisation")
                  : text("Probeer eerst de demo", "Try the demo first")}
              </Link>
            </Button>
          </div>
        );
        return (
          <section
            key={group}
            className={
              cards
                ? "space-y-0"
                : compact
                  ? "grid gap-8 border-t pt-10 lg:grid-cols-[.8fr_1.2fr]"
                  : "space-y-6"
            }
          >
            {!cards && (
              <div className={compact ? "max-w-3xl" : "mx-auto max-w-3xl text-center"}>
                <Badge variant="outline">
                  {agency
                    ? text("Voor reisprofessionals", "For travel professionals")
                    : text("Voor persoonlijke en groepsreizen", "For personal and group trips")}
                </Badge>
                <h2 className="mt-4 font-display text-3xl font-semibold">
                  {agency
                    ? text(
                        "GlobeTrotr Agency voor jouw organisatie",
                        "GlobeTrotr Agency for your organisation",
                      )
                    : text("Jouw reis, alleen of samen", "Your trip, solo or together")}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {agency
                    ? text(
                        "Organiseer reizen voor klanten met je team, eigen branding en zakelijke communicatie. Agency is een betaald abonnement voor professioneel reisbeheer.",
                        "Organise client trips with your team, custom branding and business communication. Agency is a paid plan for professional travel management.",
                      )
                    : text(
                        "Samen plannen kan al met Free, voor twee eigen actieve reizen. Pro biedt onbeperkt reizen en extra functies. Voor een reis met vrienden of familie heb je geen Agency nodig.",
                        "Planning together is included in Free, for two active trips of your own. Pro adds unlimited trips and extra features. A trip with friends or family does not require Agency.",
                      )}
                </p>
                {compact && actions}
              </div>
            )}
            <div
              className={`mx-auto grid gap-4 ${cards ? "sm:grid-cols-3" : agency ? (compact ? "w-full" : "max-w-2xl") : compact ? "w-full sm:grid-cols-2" : "lg:grid-cols-2"}`}
            >
              {plans.map((plan) => {
                const detail = DETAILS[plan.id],
                  Icon = detail.icon;
                return (
                  <Card
                    key={plan.id}
                    className={`${cards ? "h-full rounded-2xl bg-background/70 shadow-none" : compact ? "h-full marketing-plan" : "surface"} ${plan.id === "pro" ? (cards ? "border-primary/60 ring-1 ring-primary/10" : compact ? "border-primary" : "border-primary ring-1 ring-primary/20") : ""}`}
                  >
                    <CardContent className={compact ? "p-5" : "p-6"}>
                      <div
                        className={`flex items-start justify-between gap-3 ${cards ? "flex-wrap" : ""}`}
                      >
                        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </span>
                        {plan.id === "pro" && (
                          <Badge>{text("Meer reisruimte", "More room to travel")}</Badge>
                        )}
                      </div>
                      <div
                        className={
                          cards || compact
                            ? "mt-4 space-y-3"
                            : "mt-4 flex flex-wrap items-end justify-between gap-3"
                        }
                      >
                        <div>
                          <h3 className="font-display text-2xl font-semibold">{plan.name}</h3>
                          <p
                            className={`mt-1 text-xs text-muted-foreground ${cards || compact ? "sm:min-h-8" : ""}`}
                          >
                            {text(detail.audience[0], detail.audience[1])}
                          </p>
                        </div>
                        <p className="font-display text-2xl font-semibold">
                          {plan.price ? (
                            <>
                              &euro;{plan.price}
                              <span className="text-xs font-normal text-muted-foreground">
                                /{text("maand", "month")}
                              </span>
                            </>
                          ) : (
                            text("Gratis", "Free")
                          )}
                        </p>
                      </div>
                      <ul className="mt-5 space-y-2 text-sm">
                        {detail.features.map((item) => (
                          <li key={item[0]} className="flex gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            {text(item[0], item[1])}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {!compact && actions}
          </section>
        );
      })}
    </div>
  );
}
