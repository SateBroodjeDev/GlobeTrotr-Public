import { createFileRoute } from "@tanstack/react-router";
import {
  Bug,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PUBLIC_RELEASES,
  type PublicChangeKind,
} from "@/lib/public-changelog";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Wat is er nieuw? — GlobeTrotr" },
      {
        name: "description",
        content: "Bekijk de nieuwste verbeteringen en oplossingen in GlobeTrotr.",
      },
      { property: "og:title", content: "Wat is er nieuw in GlobeTrotr?" },
      {
        property: "og:description",
        content: "Nieuwe functies, verbeteringen en oplossingen in GlobeTrotr.",
      },
    ],
    links: [{ rel: "canonical", href: "https://globetrotr.nl/updates" }],
  }),
  component: ChangelogPage,
});

const KIND = {
  new: { label: ["Nieuw", "New"], icon: Rocket, className: "bg-primary/10 text-primary" },
  improved: {
    label: ["Verbeterd", "Improved"],
    icon: Sparkles,
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  fixed: {
    label: ["Opgelost", "Fixed"],
    icon: Bug,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  secure: {
    label: ["Veiliger", "Safer"],
    icon: LockKeyhole,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
} satisfies Record<
  PublicChangeKind,
  { label: [string, string]; icon: typeof Rocket; className: string }
>;

export function ChangelogPage() {
  const { locale, text } = useLocale();
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="aurora overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
        <Badge variant="secondary" className="mb-4 gap-1.5">
          <Sparkles className="size-3" /> {text(PUBLIC_RELEASES[0].title, PUBLIC_RELEASES[0].titleEn).split(":")[0]}
        </Badge>
        <h1 className="font-display text-3xl font-semibold sm:text-5xl">
          {text("Wat is er nieuw?", "What's new?")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm opacity-90 sm:text-base">
          {text(
            "Nieuwe functies, verbeteringen en oplossingen. Helder uitgelegd, zodat je meteen weet wat er voor jou is veranderd.",
            "New features, improvements and fixes, explained clearly so you know what has changed.",
          )}
        </p>
      </header>

      <div className="relative space-y-8 before:absolute before:bottom-0 before:left-[19px] before:top-3 before:w-px before:bg-border sm:before:left-[27px]">
        {PUBLIC_RELEASES.map((release, releaseIndex) => (
          <article key={release.id} className="relative pl-12 sm:pl-16">
            <div className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-primary/20 bg-background text-primary shadow-sm sm:size-14">
              {releaseIndex === 0 ? (
                <Rocket className="size-5 sm:size-6" />
              ) : (
                <CheckCircle2 className="size-5 sm:size-6" />
              )}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> {formatDate(release.publishedAt, locale)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-3.5" /> {formatTime(release.publishedAt, locale)}
              </span>
              {releaseIndex === 0 && (
                <Badge className="ml-auto">{text("Nieuwste update", "Latest update")}</Badge>
              )}
              <Badge variant="outline">{release.version}</Badge>
            </div>
            <Card className="surface overflow-hidden">
              <CardContent className="p-5 sm:p-7">
                <h2 className="font-display text-xl font-semibold sm:text-2xl">
                  {text(release.title, release.titleEn)}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {text(release.summary, release.summaryEn)}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {release.changes.map((change) => {
                    const config = KIND[change.kind];
                    const Icon = config.icon;
                    return (
                      <div
                        key={change.title}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid size-8 place-items-center rounded-lg ${config.className}`}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {text(config.label[0], config.label[1])}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold">
                          {text(change.title, change.titleEn)}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {text(change.description, change.descriptionEn)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string, locale: "nl-NL" | "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function formatTime(value: string, locale: "nl-NL" | "en-GB") {
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
  return locale === "nl-NL" ? `${time} uur` : `${time} Amsterdam time`;
}
