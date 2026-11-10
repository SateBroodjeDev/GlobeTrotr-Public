import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Stop, Trip } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { ManualLocationEditor } from "@/components/ManualLocationEditor";
import { Button } from "@/components/ui/button";
import { pruneRoutePlan } from "@/lib/route-map";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DestinationLocationEditor({
  stop,
  save,
}: {
  stop: Stop;
  save: (update: (trip: Trip) => Trip) => Promise<unknown>;
}) {
  const { text } = useLocale();
  const [original, setOriginal] = useState<Stop>();
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="col-span-2 justify-self-start gap-1 text-xs text-muted-foreground"
        aria-label={text(`Locatie wijzigen voor ${stop.name}`, `Edit location for ${stop.name}`)}
        onClick={(event) => {
          event.stopPropagation();
          setOriginal({ ...stop });
        }}
      >
        <Pencil className="size-3" />
        {text("Locatie / adres", "Location / address")}
      </Button>
      <Dialog
        open={!!original}
        onOpenChange={(open) => {
          if (!open && !saving) setOriginal(undefined);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          onClick={(event) => event.stopPropagation()}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{text("Bestemming wijzigen", "Edit destination")}</DialogTitle>
          </DialogHeader>
          {original && (
            <ManualLocationEditor
              initialLocation={original}
              disabled={saving}
              onCancel={() => setOriginal(undefined)}
              onPick={async (location) => {
                setSaving(true);
                try {
                  await save((current) => {
                    const actual = current.stops.find((candidate) => candidate.id === original.id);
                    if (
                      !actual ||
                      ["name", "country", "city", "addressLine", "lat", "lon"].some(
                        (key) => actual[key as keyof Stop] !== original[key as keyof Stop],
                      )
                    )
                      throw new Error("LOCATION_STALE");
                    return pruneRoutePlan({
                      ...current,
                      stops: current.stops.map((candidate) =>
                        candidate.id === original.id
                          ? {
                              ...candidate,
                              ...location,
                              city: location.city ?? "",
                              addressLine: location.addressLine ?? "",
                            }
                          : candidate,
                      ),
                    });
                  });
                  setOriginal(undefined);
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
