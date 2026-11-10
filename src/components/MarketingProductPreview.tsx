import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImageOff, Image } from "lucide-react";
import { MarketingLink as Link } from "@/components/MarketingLink";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/lib/locale";

type View = "route" | "expenses";

function PreviewImage({ view }: { view: View }) {
  const { language, text } = useLocale();
  const src = `/assets/product/demo-${view}-${language}.webp`;
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setHydrated(true);
    // Cached or nearby lazy images may finish before hydration attaches events.
    if (!image.current?.complete) return;
    if (image.current.naturalWidth > 0) setLoaded(src);
    else setFailed(src);
  }, [src]);
  return (
    <figure>
      <div className="relative aspect-[1152/753] overflow-hidden rounded-2xl border bg-background">
        {hydrated && loaded !== src && failed !== src && (
          <div
            role="status"
            className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-muted/30 text-sm text-muted-foreground"
          >
            <Image className="size-5" />
            {text("Voorbeeld laden…", "Loading preview…")}
          </div>
        )}
        {failed === src ? (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"
          >
            <ImageOff className="size-6" />
            <p>
              {text("Het voorbeeld kon niet worden geladen.", "The preview could not be loaded.")}
            </p>
            <Link to="/demo" className="font-medium text-primary underline underline-offset-4">
              {text("Open de interactieve demo", "Open the interactive demo")}
            </Link>
          </div>
        ) : (
          <img
            ref={image}
            src={src}
            width={1152}
            height={753}
            loading="lazy"
            decoding="async"
            className="size-full object-contain"
            onLoad={() => setLoaded(src)}
            onError={() => setFailed(src)}
            alt={
              view === "route"
                ? text(
                    "Routevoorbeeld van de Noordlicht-oefenreis in de interactieve GlobeTrotr-demo",
                    "Route example from the Northern lights practice trip in the interactive GlobeTrotr demo",
                  )
                : text(
                    "Kostenoverzicht met de fictieve reizigers Noor en Sam in de GlobeTrotr-demo",
                    "Expense overview with fictional travellers Noor and Sam in the GlobeTrotr demo",
                  )
            }
          />
        )}
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {text(
          "Weergave uit de interactieve demo · fictieve reisgegevens",
          "View from the interactive demo · fictional trip data",
        )}
      </figcaption>
    </figure>
  );
}

export function MarketingProductPreview({ view }: { view?: View }) {
  const { text } = useLocale();
  return (
    <section className="marketing-product-preview space-y-6 rounded-3xl border bg-card/40 p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {text("Een kijkje in de planner", "A look inside the planner")}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            {view === "expenses"
              ? text("Samen op reis. Kosten helder.", "Travel together. Keep expenses clear.")
              : text("Van losse ideeën naar één reis", "From separate ideas to one trip")}
          </h2>
        </div>
        <Link
          to="/demo"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-primary"
        >
          {text("Probeer het zelf", "Try it yourself")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
      {view ? (
        <PreviewImage view={view} />
      ) : (
        <Tabs defaultValue="route">
          <TabsList className="mb-4 h-auto gap-1 p-1">
            <TabsTrigger value="route" className="min-h-10 px-5">
              {text("Route", "Route")}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="min-h-10 px-5">
              {text("Kosten verdelen", "Split expenses")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="route">
            <PreviewImage view="route" />
          </TabsContent>
          <TabsContent value="expenses">
            <PreviewImage view="expenses" />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
