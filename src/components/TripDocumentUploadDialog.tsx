import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/locale";
import { DOCUMENT_TYPES, uploadTripDocument, validateDocumentUpload, type DocumentType, type DocumentUpload } from "@/lib/trip-document-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TripDocumentUploadDialog({ tripId, booking, editable, onClose }: {
  tripId: string; booking: { id: string; title: string }; editable: boolean; onClose: () => void;
}) {
  const { text } = useLocale(), query = useQueryClient();
  const [file, setFile] = useState<File>(), [type, setType] = useState<DocumentType>("ticket"), [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const attempt = useRef<DocumentUpload | undefined>(undefined), committing = useRef(false);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const frozen = busy || Boolean(attempt.current && attempt.current.stage !== "new");
  const labels: Record<DocumentType, string> = { ticket: "Ticket", voucher: "Voucher", insurance: text("Verzekering", "Insurance"), visa: text("Visum", "Visa"), booking: text("Boekingsbevestiging", "Booking confirmation"), other: text("Overig", "Other") };
  const close = () => {
    if (committing.current) return;
    if (attempt.current?.stage === "uncertain" && !window.confirm(text(
      "De opslagstatus is nog onbekend. Controleer na sluiten eerst Documenten voordat je opnieuw uploadt. Toch sluiten?",
      "Saving is still unconfirmed. After closing, check Documents before uploading again. Close anyway?",
    ))) return;
    onClose();
  };
  async function submit() {
    if (!editable || committing.current || !file) return;
    const draft = attempt.current ?? { id: crypto.randomUUID(), tripId, bookingId: booking.id, file, type, expiresOn, stage: "new" as const };
    if (draft.stage === "new") Object.assign(draft, { file, type, expiresOn });
    try { validateDocumentUpload(draft); }
    catch { setError(text("Kies een PDF, JPG, PNG of WebP tot 15 MB en een geldige optionele vervaldatum.", "Choose a PDF, JPG, PNG or WebP up to 15 MB and a valid optional expiry date.")); return; }
    attempt.current = draft; committing.current = true; setBusy(true); setError("");
    try {
      await uploadTripDocument(supabase as any, draft);
      await Promise.all([
        query.invalidateQueries({ queryKey: ["trip-documents", tripId] }),
        query.invalidateQueries({ queryKey: ["trip-documents-offline", tripId] }),
      ]);
      onClose();
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : "";
      setError(code === "DOCUMENT_BOOKING_UNAVAILABLE" || code === "DOCUMENT_TRIP_UNAVAILABLE"
        ? text("De boeking is niet meer beschikbaar of je hebt geen toegang. Herlaad de reis.", "The booking is unavailable or you no longer have access. Reload the trip.")
        : text("Opslaan is niet bevestigd. Je bestand en type blijven bewaard. Opnieuw proberen controleert dezelfde upload, zonder een nieuw document aan te maken.", "Saving is unconfirmed. Your file and type are retained. Retrying checks the same upload without creating a new document."));
    } finally { committing.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent data-document-upload className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} onEscapeKeyDown={event => { if (committing.current) event.preventDefault(); }} onInteractOutside={event => { if (committing.current) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{text("Document toevoegen", "Add document")}</DialogTitle><DialogDescription>{booking.title} · {text("Het document wordt direct bij deze opgeslagen boeking bewaard en blijft privé.", "The document is added directly to this saved booking and stays private.")}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void submit(); }} aria-busy={busy} className="space-y-4">
        <fieldset disabled={frozen || !editable} className="space-y-4">
          <label className="block space-y-2 text-sm"><span>{text("Document", "Document")}</span><Input name="document-file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => { setFile(event.target.files?.[0]); setError(""); }} /></label>
          {file && <p className="flex items-center gap-2 break-all text-xs text-muted-foreground"><FileText className="size-4 shrink-0"/>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          <label className="block space-y-2 text-sm"><span>{text("Documenttype", "Document type")}</span><select name="document-type" className="form-control w-full" value={type} onChange={event => setType(event.target.value as DocumentType)}>{DOCUMENT_TYPES.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
          <label className="block space-y-2 text-sm"><span>{text("Vervaldatum (optioneel)", "Expiry date (optional)")}</span><Input name="document-expiry" type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)}/></label>
          <p className="text-xs text-muted-foreground">{text("PDF, JPG, PNG of WebP · maximaal 15 MB.", "PDF, JPG, PNG or WebP · up to 15 MB.")}</p>
        </fieldset>
        {!editable && <p role="alert" className="text-sm text-destructive">{text("Je kunt deze boeking niet meer bewerken.", "You can no longer edit this booking.")}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={close}>{text("Annuleren", "Cancel")}</Button><Button type="submit" disabled={busy || !editable || !file}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Upload className="size-4"/>}{busy ? text("Uploaden…", "Uploading…") : error ? text("Opnieuw proberen", "Retry") : text("Document toevoegen", "Add document")}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
