import { ArrowRight, ShieldCheck } from "lucide-react";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { portalUrl } from "@/lib/site-routing";

export function MarketingClosing({
  title,
  description,
  agency = false,
  onDemo = false,
}: {
  title: readonly [string, string];
  description: readonly [string, string];
  agency?: boolean;
  onDemo?: boolean;
}) {
  const { user } = useAuth();
  const { text } = useLocale();
  return (
    <section className="marketing-invitation grid gap-6 px-6 py-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="max-w-2xl">
        <ShieldCheck className="mb-4 size-6 text-primary" />
        <h2 className="font-display text-3xl font-semibold">{text(...title)}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text(...description)}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
        <Button asChild size="lg">
          <a
            href={portalUrl(
              agency
                ? user
                  ? "/billing"
                  : "/auth?redirect=%2Fbilling"
                : user
                  ? "/dashboard"
                  : "/register",
            )}
          >
            {agency
              ? text("Start met Agency", "Get started with Agency")
              : user
                ? text("Open mijn reizen", "Open my trips")
                : text("Start gratis", "Start for free")}
            <ArrowRight className="size-4" />
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to={agency ? "/contact" : onDemo ? "/pricing" : "/demo"}>
            {agency
              ? text("Bespreek jouw organisatie", "Discuss your organisation")
              : onDemo
                ? text("Bekijk de abonnementen", "View plans")
                : text("Probeer eerst de demo", "Try the demo first")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
