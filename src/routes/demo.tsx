import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingDemo } from "@/components/LandingDemo";
import { MarketingMotion } from "@/components/MarketingMotion";
import { MarketingClosing } from "@/components/MarketingClosing";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Interactive product tour — GlobeTrotr" },
      {
        name: "description",
        content:
          "Try one guided trip: explore routes, bookings, collaboration, expenses and your travel journal without an account.",
      },
      { property: "og:title", content: "Try the GlobeTrotr product tour" },
      {
        property: "og:description",
        content: "One sample trip, from planning together to keeping your memories.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/demo" }],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { text } = useLocale();
  return (
    <MarketingMotion className="marketing-page demo-page space-y-8 pb-8 sm:space-y-10">
      <section className="marketing-hero mx-auto max-w-3xl py-4 text-center sm:py-6">
        <Badge variant="secondary">{text("Zelf proberen", "Try it yourself")}</Badge>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-5xl">
          {text("Eén reis. Ontdek hoe alles samenkomt.", "One trip. Discover how it all connects.")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {text(
            "Plan met Noor en Sam een Noordlichtavontuur. Kies een onderdeel en probeer het direct; je hebt geen account nodig.",
            "Plan a northern lights adventure with Noor and Sam. Choose a section and try it out; no account needed.",
          )}
        </p>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-primary">
          <CheckCircle2 className="size-4" />
          {text(
            "Voorbeeldgegevens · geen echte boekingen of betalingen",
            "Sample data · no real bookings or payments",
          )}
        </p>
      </section>
      <LandingDemo expanded />
      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
        {text(
          "Afstanden, beschikbaarheid en vluchtupdates zijn gesimuleerd. Offline bewaren is een oefening; er worden geen bestanden gedownload. Je wijzigingen verdwijnen als je de pagina verlaat.",
          "Distances, availability and flight updates are simulated. Offline saving is a practice action; no files are downloaded. Your changes disappear when you leave the page.",
        )}
      </p>
      <MarketingClosing
        onDemo
        title={["Nu jouw eigen reis", "Now make it your own"]}
        description={[
          "Begin gratis met twee actieve reizen en nodig je reisgenoten uit.",
          "Start for free with two active trips and invite your fellow travellers.",
        ]}
      />
      <div className="text-center">
        <Link
          to="/features"
          className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {text("Bekijk alle mogelijkheden", "Explore all features")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </MarketingMotion>
  );
}
