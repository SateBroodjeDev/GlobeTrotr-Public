import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function LegalPage({ icon: Icon, badge, title, intro, children, version }: { icon: LucideIcon; badge: string; title: string; intro: string; children: ReactNode; version: string }) {
  return <div className="mx-auto max-w-4xl space-y-8">
    <header className="aurora rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
      <Badge variant="secondary" className="mb-4 gap-1.5"><Icon className="size-3.5" />{badge}</Badge>
      <h1 className="max-w-3xl font-display text-3xl font-semibold sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90 sm:text-base">{intro}</p>
      <p className="mt-4 text-xs opacity-70">{version}</p>
    </header>
    <Card className="surface"><CardContent className="space-y-8 p-6 sm:p-8">{children}</CardContent></Card>
  </div>;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="font-display text-lg font-semibold">{title}</h2><div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div></section>;
}
