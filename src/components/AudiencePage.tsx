import { MarketingLink as Link } from "@/components/MarketingLink";
import { MarketingClosing } from "@/components/MarketingClosing";
import { MarketingMotion } from "@/components/MarketingMotion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JourneyScene } from "@/components/JourneyScene";
import { GroupTripPreview } from "@/components/GroupTripPreview";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { portalUrl } from "@/lib/site-routing";

type Copy = readonly [string, string];
type Highlight = { icon: LucideIcon; title: Copy; body: Copy };

export function AudiencePage({
  badge,
  title,
  intro,
  highlights,
  workflow,
  audience = "travelers",
  experience = "travelers",
  children,
}: {
  badge: Copy;
  title: Copy;
  intro: Copy;
  highlights: Highlight[];
  workflow: Copy[];
  audience?: "travelers" | "agency";
  experience?: "travelers" | "groups";
  children?: ReactNode;
}) {
  const { text } = useLocale();
  const { user } = useAuth();
  return (
    <MarketingMotion
      className={`marketing-page marketing-page--${audience === "agency" ? "agency" : experience} space-y-20 pb-8`}
    >
      <section className="marketing-hero grid items-center gap-10 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-14">
        <div>
          <Badge variant="secondary">{text(...badge)}</Badge>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {text(...title)}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-85 sm:text-lg">
            {text(...intro)}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a
                href={portalUrl(
                  audience === "agency"
                    ? user
                      ? "/billing"
                      : "/auth?redirect=%2Fbilling"
                    : user
                      ? "/dashboard"
                      : "/register",
                )}
              >
                {audience === "agency"
                  ? text("Start met Agency", "Get started with Agency")
                  : user
                    ? text("Open mijn reizen", "Open my trips")
                    : text("Gratis je reis plannen", "Plan your trip for free")}
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={audience === "agency" ? "/contact" : "/demo"}>
                {audience === "agency"
                  ? text("Bespreek jouw organisatie", "Discuss your organisation")
                  : text("Bekijk de demo", "View the demo")}
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {audience === "agency"
              ? text(
                  "Voor klantreizen en professioneel beheer. Agency is een betaald abonnement.",
                  "For client trips and professional management. Agency is a paid plan.",
                )
              : text(
                  "Alleen, met je partner of met een groep: samen plannen kan al met Free.",
                  "Solo, with your partner or with a group: planning together is included in Free.",
                )}
          </p>
        </div>
        {audience === "agency" ? (
          <JourneyScene variant="agency" />
        ) : experience === "groups" ? (
          <GroupTripPreview />
        ) : (
          <JourneyScene />
        )}
      </section>
      <section className="audience-highlights grid gap-8 border-y py-10 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title: itemTitle, body }) => (
          <article key={itemTitle[0]} className="marketing-highlight">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h2 className="mt-5 font-display text-xl font-semibold">{text(...itemTitle)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text(...body)}</p>
          </article>
        ))}
      </section>
      {!children && (
        <section className="marketing-workflow py-5">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <ShieldCheck className="size-8 text-primary" />
              <h2 className="mt-4 font-display text-3xl font-semibold">
                {audience === "agency"
                  ? text(
                      "Een heldere werkdag. Een persoonlijke reis.",
                      "A clear working day. A personal journey.",
                    )
                  : experience === "groups"
                    ? text(
                        "Iedereen betrokken, alles bij elkaar.",
                        "Everyone involved, everything together.",
                      )
                    : text("Geef je avontuur de ruimte.", "Give your adventure room.")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {audience === "agency"
                  ? text(
                      "Van klantgegevens tot de laatste reisdocumenten: houd je werkvoorraad zichtbaar en geef medewerkers toegang die bij hun taak past.",
                      "From client details to final travel documents: keep your workload visible and give team members access suited to their task.",
                    )
                  : experience === "groups"
                    ? text(
                        "De één zoekt een verblijf, de ander houdt de kosten bij. Iedereen draagt bij, terwijl jullie dezelfde planning gebruiken.",
                        "One person finds a stay, another tracks expenses. Everyone contributes while sharing the same itinerary.",
                      )
                    : text(
                        "Een weekend weg, een zonvakantie of een lange rondreis: bouw je eigen planning op en neem alleen mee wat voor jouw reis telt.",
                        "A weekend away, a beach holiday or a long road trip: build your own itinerary and take only what matters to your journey.",
                      )}
              </p>
            </div>
            <ol className="space-y-3">
              {workflow.map((step, index) => (
                <li key={step[0]} className="flex gap-4 border-b py-5 last:border-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm font-medium">{text(...step)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      {children}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold">
            {audience === "agency"
              ? text("Een werkplek voor je reisorganisatie", "A workspace for your travel business")
              : text("Samen plannen kan al met Free", "Planning together is included in Free")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {audience === "agency"
              ? text(
                  "Agency is een betaald abonnement voor klantreizen, je team en je eigen merk.",
                  "Agency is a paid plan for client trips, your team and your own brand.",
                )
              : text(
                  "Begin met twee actieve reizen. Pro biedt extra reisruimte en onder meer live weer.",
                  "Start with two active trips. Pro adds more room to travel and extras including live weather.",
                )}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 self-start sm:self-auto">
          <Link to="/pricing">
            {text("Bekijk de abonnementen", "View plans")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
      <MarketingClosing
        agency={audience === "agency"}
        title={
          audience === "agency"
            ? ["Geef jouw reisorganisatie overzicht", "Bring clarity to your travel business"]
            : ["Je volgende reis begint hier", "Your next trip starts here"]
        }
        description={
          audience === "agency"
            ? [
                "Ontdek het betaalde Agency-abonnement of bespreek eerst wat jouw organisatie nodig heeft.",
                "Explore the paid Agency plan or first discuss what your organisation needs.",
              ]
            : [
                "Begin gratis, plan alleen of samen en houd alles bij dezelfde reis.",
                "Start for free, plan solo or together and keep everything with the same trip.",
              ]
        }
      />
    </MarketingMotion>
  );
}
