import { useMemo, useState } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Trip } from "@/lib/types";
import { previewTripDateShift, shiftTripDates } from "@/lib/trip-date-shift";

export function TripDateShift({ trip, disabled, save, text }: {
  trip: Trip;
  disabled: boolean;
  save: (update: (current: Trip) => Trip) => Promise<void>;
  text: (nl: string, en: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [newStart, setNewStart] = useState(trip.start);
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => {
    try { return previewTripDateShift(trip, newStart); } catch { return null; }
  }, [newStart, trip]);
  async function apply() {
    if (!preview || preview.days === 0) return;
    setSaving(true);
    try {
      await save((current) => shiftTripDates(current, newStart));
      toast.success(text("Alle planningsdatums zijn verschoven.", "All planning dates have been shifted."));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text("Datums konden niet worden verschoven.", "Dates could not be shifted."));
    } finally { setSaving(false); }
  }
  const direction = preview && preview.days < 0 ? text("eerder", "earlier") : text("later", "later");
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setNewStart(trip.start); }}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}><CalendarRange className="size-4" />{text("Reisdatums verschuiven", "Shift trip dates")}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{text("Reisdatums verschuiven", "Shift trip dates")}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{text("Kies een nieuwe startdatum. Bekijk eerst precies welke planning wordt aangepast.", "Choose a new start date. Review exactly which planning data will change first.")}</p>
        <label className="space-y-2"><Label>{text("Nieuwe startdatum", "New start date")}</Label><Input type="date" value={newStart} onChange={(event) => setNewStart(event.target.value)} /></label>
        {preview && <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">{preview.days === 0 ? text("De startdatum verandert niet.", "The start date does not change.") : `${Math.abs(preview.days)} ${Math.abs(preview.days) === 1 ? text("dag", "day") : text("dagen", "days")} ${direction}`}</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1"><dt>{text("Reisperiode", "Trip period")}</dt><dd>{preview.newStart} – {preview.newEnd}</dd><dt>{text("Bestemmingen", "Destinations")}</dt><dd>{preview.stops}</dd><dt>{text("Dagplanning", "Itinerary")}</dt><dd>{preview.itineraryItems}</dd><dt>{text("Boekingen", "Bookings")}</dt><dd>{preview.bookings}</dd><dt>{text("Vergelijkingskandidaten", "Comparison candidates")}</dt><dd>{preview.candidates}</dd></dl>
          <p className="text-xs text-muted-foreground">{text("Uitgaven en administratieve controledata blijven ongewijzigd. Reserveringen bij externe aanbieders worden niet aangepast; controleer die zelf.", "Expenses and administrative check dates remain unchanged. Reservations with external providers are not changed; verify those separately.")}</p>
        </div>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{text("Annuleren", "Cancel")}</Button><Button type="button" disabled={!preview || preview.days === 0 || saving} onClick={() => void apply()}>{saving && <Loader2 className="size-4 animate-spin" />}{text("Datums verschuiven", "Shift dates")}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
