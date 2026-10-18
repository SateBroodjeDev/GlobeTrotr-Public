import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, Check, CircleAlert, Plane, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { PLANS } from "@/lib/plans";
import { portalUrl } from "@/lib/site-routing";
export const Route = createFileRoute("/prijzen")({
  head: () => ({
    meta: [
      { title: "Prijzen — GlobeTrotr" },
      {
        name: "description",
        content:
          "Vergelijk GlobeTrotr Free, Pro en Agency en kies wat bij jouw manier van reizen of werken past.",
      },
      { property: "og:title", content: "GlobeTrotr Free, Pro en Agency" },
      {
        property: "og:description",
        content: "Vergelijk plannen op reizen, samenwerking, opslag en professioneel beheer.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/pricing" }],
  }),
  component: PricingPage,
});
const copy = {
  free: {
    icon: Plane,
    nl: "Voor wie af en toe een eigen reis plant",
    en: "For anyone planning an occasional personal trip",
    bodyNl:
      "Plan twee actieve reizen met je groep, houd uitgaven bij en maak zonder betaalgegevens een compleet reisdagboek.",
    bodyEn:
      "Plan two active trips with your group, track expenses and create a complete travel journal without payment details.",
  },
  pro: {
    icon: Users,
    nl: "Meer ruimte voor eigen reizen, alleen of samen",
    en: "More room for your own trips, solo or together",
    bodyNl:
      "Plan onbeperkt en krijg live weer, ruimere vlucht- en routecontroles en een PDF-declaratie voor uitgaven.",
    bodyEn:
      "Plan unlimited trips with live weather, higher flight and routing allowances, and PDF expense reports.",
  },
  agency: {
    icon: BriefcaseBusiness,
    nl: "Voor reisadviseurs en reisorganisaties",
    en: "For travel advisers and businesses",
    bodyNl: "Beheer klanten, teamrechten, offertes, taken, leveranciers en je eigen merk.",
    bodyEn: "Manage clients, permissions, quotes, tasks, suppliers and your own brand.",
  },
} as const;
const matrix = [
  ["Actieve reizen", "Active trips", "2", "Onbeperkt", "Onbeperkt"],
  [
    "Route, planning, paklijst en uitgaven",
    "Routes, itinerary, packing and expenses",
    "✓",
    "✓",
    "✓",
  ],
  ["Samenwerken en slim verrekenen", "Collaboration and smart settlement", "✓", "✓", "✓"],
  ["Reisdagboek, foto's en samenvatting", "Travel journal, photos and summary", "✓", "✓", "✓"],
  [
    "Openbare live terugblik en e-mailvolgers",
    "Public live story and email followers",
    "✓",
    "✓",
    "✓",
  ],
  [
    "Openbaar reizigersprofiel, landen en vrienden",
    "Public traveller profile, countries and friends",
    "✓",
    "✓",
    "—",
  ],
  ["Offline reis en synchronisatiewachtrij", "Offline trip and sync queue", "✓", "✓", "✓"],
  ["Vergelijker, peilingen en reacties", "Comparison, polls and comments", "✓", "✓", "✓"],
  ["Persoonlijke en gezamenlijke paklijsten", "Personal and shared packing lists", "✓", "✓", "✓"],
  ["Ontbrekende nachten en Ontdekken", "Missing nights and Discover", "✓", "✓", "✓"],
  ["Live weer per bestemming", "Live weather for each destination", "—", "✓", "✓"],
  ["Vluchtcontroles per gebruiker per dag", "Flight checks per user per day", "3", "30", "300"],
  [
    "Routeaanvragen per gebruiker per dag",
    "Routing requests per user per day",
    "25",
    "250",
    "2.500",
  ],
  ["CSV-, JSON-, GPX- en agenda-export", "CSV, JSON, GPX and calendar export", "✓", "✓", "✓"],
  [
    "Live agenda-abonnement via persoonlijke ICS-link",
    "Live calendar subscription through a personal ICS link",
    "—",
    "✓",
    "✓",
  ],
  ["Reisdagboek als PDF", "Travel journal as PDF", "✓", "✓", "✓"],
  ["PDF-declaratie van uitgaven", "PDF expense report", "—", "✓", "✓"],
  [
    "Klanten, offertes, taken en leveranciers",
    "Clients, quotes, tasks and suppliers",
    "—",
    "—",
    "✓",
  ],
  ["Teamrollen en zakelijke rechten", "Team roles and business permissions", "—", "—", "✓"],
  [
    "Eigen branding, subdomein en geverifieerd domein",
    "Custom branding, subdomain and verified domain",
    "—",
    "—",
    "✓",
  ],
  ["Eigen SMTP en klantcommunicatie", "Custom SMTP and client communication", "—", "—", "✓"],
] as const;
const highlightEn: Record<string, string> = {
  "2 actieve reizen": "2 active trips",
  "Routekaart & uitgaven": "Route map and expenses",
  "CSV-export": "CSV export",
  "Samen plannen en uitgaven verdelen": "Plan together and split expenses",
  "Reisdagboek en openbare live terugblik": "Travel journal and public live story",
  "Offline overzicht en open exports": "Offline overview and open exports",
  "Onbeperkt reizen": "Unlimited trips",
  "Live weer en ruimere vlucht- en routelimieten":
    "Live weather and higher flight and routing allowances",
  "PDF-declaratie voor uitgaven": "PDF expense report",
  "Alles uit Free": "Everything in Free",
  "Eigen merk en domein": "Custom brand and domain",
  "Rollen en rechten": "Roles and permissions",
  "Declarabele klantuitgaven": "Billable client expenses",
  "Bonnetjes bij uitgaven": "Expense receipts",
};
export function PricingPage() {
  const { user } = useAuth();
  const { text } = useLocale();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "GlobeTrotr",
            applicationCategory: "TravelApplication",
            operatingSystem: "Web",
            offers: PLANS.map((plan) => ({
              "@type": "Offer",
              name: plan.name,
              price: String(plan.price),
              priceCurrency: "EUR",
            })),
          }),
        }}
      />
      <div className="marketing-page mx-auto max-w-6xl space-y-16 pb-10">
        <header className="marketing-hero border-b py-12 text-center sm:py-16">
          <Badge variant="secondary">
            {text("Kies op basis van hoe je reist", "Choose based on how you travel")}
          </Badge>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold sm:text-5xl">
            {text("Een helder plan voor iedere reis", "A clear plan for every journey")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed opacity-90">
            {text(
              "Free bevat de complete reisplanner voor maximaal twee actieve reizen. Pro haalt de reislimiet weg. Agency voegt klantbeheer, teamrechten, eigen branding, domeinen en zakelijke communicatie toe.",
              "Free contains the complete travel planner for up to two active trips. Pro removes the trip limit. Agency adds client management, team permissions, custom branding, domains and business communication.",
            )}
          </p>
        </header>
        {(["travelers", "agency"] as const).map((audience) => (
          <section key={audience} id={audience} className="scroll-mt-24 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-semibold">
                {audience === "agency"
                  ? text("Voor reisprofessionals", "For travel professionals")
                  : text("Voor persoonlijke en groepsreizen", "For personal and group trips")}
              </h2>
              <p className="text-muted-foreground">
                {audience === "agency"
                  ? text(
                      "Reizen organiseren voor klanten, met medewerkers, eigen branding en zakelijke administratie.",
                      "Organise trips for clients, with staff, custom branding and business administration.",
                    )
                  : text(
                      "Plan je eigen reis, alleen of samen. Samenwerken en kosten verdelen kan al met Free.",
                      "Plan your own trip, solo or together. Collaboration and expense splitting are included in Free.",
                    )}
              </p>
            </div>
            <div className={`grid gap-5 ${audience === "agency" ? "max-w-2xl" : "lg:grid-cols-2"}`}>
              {PLANS.filter((plan) =>
                audience === "agency" ? plan.id === "agency" : plan.id !== "agency",
              ).map((plan) => {
                const c = copy[plan.id],
                  Icon = c.icon;
                return (
                  <Card
                    key={plan.id}
                    className={`surface flex flex-col ${plan.id === "pro" ? "border-primary ring-1 ring-primary/20" : ""}`}
                  >
                    <CardHeader>
                      {plan.id === "pro" && (
                        <Badge className="mb-2 w-fit">
                          {text("Meer reisruimte", "More room to travel")}
                        </Badge>
                      )}
                      <Icon className="size-7 text-primary" />
                      <CardTitle className="pt-3 text-2xl">{plan.name}</CardTitle>
                      <p className="font-display text-4xl font-semibold">
                        {plan.price ? (
                          <>
                            €{plan.price}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{text("maand", "month")}
                            </span>
                          </>
                        ) : (
                          text("Gratis", "Free")
                        )}
                      </p>
                      {plan.price > 0 && <p className="text-sm text-muted-foreground">{text("Inclusief btw", "Including VAT")}</p>}
                      <p className="pt-2 font-medium">{text(c.nl, c.en)}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {text(c.bodyNl, c.bodyEn)}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <ul className="flex-1 space-y-3 text-sm">
                        {plan.highlights.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            {text(item, highlightEn[item] ?? item)}
                          </li>
                        ))}
                      </ul>
                      <Button
                        asChild
                        className="mt-7 w-full"
                        variant={plan.id === "pro" ? "default" : "outline"}
                      >
                        <a
                          href={portalUrl(
                            user
                              ? "/billing"
                              : plan.id === "free"
                                ? "/register"
                                : "/auth?redirect=%2Fbilling",
                          )}
                        >
                          {plan.id === "agency"
                            ? text("Start met Agency", "Get started with Agency")
                            : user
                              ? text("Kies of wijzig dit plan", "Choose or change this plan")
                              : plan.id === "free"
                                ? text("Start gratis", "Start free")
                                : text("Maak een account", "Create an account")}
                          <ArrowRight className="size-4" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
        <section>
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {text("Vergelijk de belangrijkste mogelijkheden", "Compare the key features")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {text(
                "Zo zie je precies wanneer overstappen zinvol wordt.",
                "See exactly when upgrading makes sense.",
              )}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-4 text-left">{text("Mogelijkheid", "Feature")}</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="p-4 text-center">
                      {p.name}
                      <span className="block font-normal text-muted-foreground">
                        {p.price ? `€${p.price}/${text("mnd", "mo")}` : text("Gratis", "Free")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row[0]} className="border-t">
                    <td className="p-4 font-medium">{text(row[0], row[1])}</td>
                    {row.slice(2).map((v, i) => (
                      <td key={i} className="p-4 text-center">
                        {v === "Onbeperkt" ? text("Onbeperkt", "Unlimited") : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {text(
              "Alleen je eigen actieve reizen tellen mee voor de Free-limiet; afgeronde, gearchiveerde en gedeelde reizen gebruiken geen actief reisslot. Je kunt ze bewaren binnen de geldende opslaglimieten. Bij een Agency-account zijn openbare reizigersprofielen uitgeschakeld; directe reislinks blijven beschikbaar. Een losse ICS-export kan met ieder plan, een live agenda-abonnement vereist Pro of Agency.",
              "Only your own active trips count towards the Free limit; completed, archived and shared trips do not use an active trip slot. You can keep them within the applicable storage limits. Public traveller profiles are disabled for Agency accounts; direct trip links remain available. A one-off ICS export is included in every plan; a live calendar subscription requires Pro or Agency.",
            )}
          </p>
        </section>
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex gap-4 p-6">
            <CircleAlert className="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">
                {text("Betaling en verlenging via Paddle", "Payment and renewal through Paddle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {text(
                  "Paddle verwerkt betaling, belasting, betalingsbewijs en terugbetaling als Merchant of Record. Kies een maandabonnement dat verlengt totdat je opzegt, of één losse maand zonder automatische verlenging. Je behoudt normaal toegang tot het einde van de betaalde periode.",
                  "Paddle processes payment, tax, receipts and refunds as Merchant of Record. Choose a monthly subscription that renews until cancelled, or one single month without automatic renewal. You normally keep access until the end of the paid period.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Link to="/terms" className="text-primary underline">
                  {text("Algemene voorwaarden", "Terms")}
                </Link>
                <Link to="/refund-policy" className="text-primary underline">
                  {text("Herroeping en terugbetaling", "Withdrawal and refunds")}
                </Link>
                <Link to="/contact" className="text-primary underline">
                  {text("Hulp bij kiezen", "Help me choose")}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
