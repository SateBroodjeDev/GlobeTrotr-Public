import { useId, useRef, useState } from "react";
import type { Stop } from "@/lib/types";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManualLocationEditor } from "@/components/ManualLocationEditor";
import type { GeoResult } from "@/lib/services";

export function DestinationDateEditor({ stop, suggestedDate, bookingDays = [], onSave, onClose, onSaveLocation }: {
  stop: Stop; suggestedDate?: string; bookingDays?: string[]; onSave: (date: string) => Promise<void>; onClose: () => void;
  onSaveLocation?: (date:string,location:GeoResult)=>Promise<void>;
}) {
  const { locale, text } = useLocale();
  const [date, setDate] = useState(stop.arrive || suggestedDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingLocation,setEditingLocation]=useState(false);
  const errorId = useId();
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onSave(date); onClose(); }
    catch (cause) {
      setError(cause instanceof Error && cause.message === "DESTINATION_DATE_INVALID"
        ? text("Vul een geldige datum in of maak het veld leeg.", "Enter a valid date or clear the field.")
        : cause instanceof Error && cause.message === "DESTINATION_DATE_CONFLICT"
          ? text("Deze bestemming is intussen gewijzigd of verwijderd. Sluit het venster en open het opnieuw.", "This destination was changed or deleted. Close this window and reopen it.")
          : text("De datum kon niet worden opgeslagen. Je invoer blijft staan; probeer opnieuw.", "The date could not be saved. Your entry is kept; please retry."));
    } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }}
      onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>{onSaveLocation ? text("Bestemming aanpassen", "Edit destination") : text("Bestemmingsdatum wijzigen", "Change destination date")}</DialogTitle>
        <DialogDescription>{stop.name}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if(!editingLocation) void save(); }}>
        {bookingDays.length > 1 && <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{text("Deze plaats komt op meerdere boekingsdagen voor. Kies welke dag je als aankomstdatum wilt gebruiken.", "This place appears on multiple booking days. Choose which day to use as the arrival date.")}</p>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{bookingDays.map(day => <Button key={day} type="button" variant="outline" size="sm" disabled={saving}
            onClick={() => { setDate(day); setError(""); }}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}</Button>)}</div>
        </div>}
        {!stop.arrive && suggestedDate && <p className="text-xs text-muted-foreground">{text("De datum uit je boeking is alvast ingevuld. Opslaan bevestigt deze als bestemmingsdatum.", "The date from your booking is prefilled. Saving confirms it as the destination date.")}</p>}
        <label className="block space-y-1 text-sm">
          <span>{text("Aankomstdatum", "Arrival date")}</span>
          <Input autoFocus type="date" value={date} disabled={saving} aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined} onChange={event => { setDate(event.target.value); setError(""); }} />
        </label>
        <p className="text-xs text-muted-foreground">{text("De nachten en boekingsdatums blijven gelijk. Maak de datum leeg om deze te verwijderen.", "Nights and booking dates stay the same. Clear the date to remove it.")}</p>
        {onSaveLocation && !editingLocation && <Button type="button" variant="ghost" className="h-auto px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-primary" disabled={saving} onClick={()=>setEditingLocation(true)}>{text("Locatie en adres aanpassen", "Edit location and address")}</Button>}
        {onSaveLocation && editingLocation && <ManualLocationEditor initialLocation={stop} disabled={saving} confirmLabel={text("Wijzigingen opslaan", "Save changes")} onCancel={onClose} onPick={async location=>{
          setSaving(true);
          try{await onSaveLocation(date,location);onClose();}finally{setSaving(false);}
        }} />}
        {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
        {!editingLocation && <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{text("Annuleren", "Cancel")}</Button>
          <Button type="submit" disabled={saving}>{saving ? text("Opslaan…", "Saving…") : text("Datum opslaan", "Save date")}</Button>
        </div>}
      </form>
    </DialogContent>
  </Dialog>;
}
