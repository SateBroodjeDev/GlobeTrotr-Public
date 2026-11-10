import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { uploadTripDocument, type DocumentType, type DocumentUpload, type TripDocument } from "@/lib/trip-document-upload";
import { useTripDocuments } from "@/components/useTripDocuments";
import { TripDocumentViewer } from "@/components/TripDocumentViewer";
type TravelItemOption = { id: string; title: string };

export function TripDocuments({ tripId, editable }: { tripId: string; editable: boolean }) {
  const { text } = useLocale();
  const db = supabase as any;
  const [type, setType] = useState<DocumentType>("ticket");
  const [travelItemId, setTravelItemId] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState("");
  const query = useTripDocuments(tripId), queryClient = useQueryClient();
  const attempt = useRef<DocumentUpload | undefined>(undefined), uploading = useRef(false);
  const [uploadError, setUploadError] = useState(false), [preview, setPreview] = useState<TripDocument>();
  const travelItemsQuery = useQuery({
    queryKey: ["trip-document-travel-items", tripId],
    queryFn: async () => {
      const { data, error } = await db.from("trip_travel_items").select("id,title").eq("trip_uuid", tripId).order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TravelItemOption[];
    }, retry: false,
  });

  async function upload(file?: File) {
    if (!editable || uploading.current || (!file && !attempt.current)) return;
    if (file) attempt.current = { id: crypto.randomUUID(), tripId, bookingId: travelItemId || undefined, file, type, expiresOn, stage: "new" };
    uploading.current = true; setUploadError(false); setBusy("upload");
    try {
      await uploadTripDocument(supabase as any, attempt.current!);
      attempt.current = undefined;
      await queryClient.invalidateQueries({ queryKey: ["trip-documents", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trip-documents-offline", tripId] });
      toast.success(text("Document toegevoegd.", "Document added."));
    } catch (failure) {
      if (failure instanceof Error && ["DOCUMENT_FILE_INVALID", "DOCUMENT_DATE_INVALID"].includes(failure.message)) {
        attempt.current = undefined;
        toast.error(text("Gebruik PDF, JPG, PNG of WebP tot 15 MB en een geldige vervaldatum.", "Use PDF, JPG, PNG or WebP up to 15 MB and a valid expiry date."));
      } else { setUploadError(true); toast.error(text("Documentopslag is niet bevestigd. Probeer dezelfde upload opnieuw.", "Document saving is unconfirmed. Retry the same upload.")); }
    } finally { uploading.current = false; setBusy(""); }
  }

  async function remove(document: TripDocument) {
    if (!editable) return;
    if (!window.confirm(text(`‘${document.file_name}’ verwijderen?`, `Delete ‘${document.file_name}’?`))) return;
    setBusy(document.id);
    try {
      const { error: storageError } = await supabase.storage.from("trip-documents").remove([document.storage_path]);
      if (storageError) throw storageError;
      const { error } = await db.from("trip_documents").delete().eq("id", document.id).eq("trip_uuid", tripId);
      if (error) throw error;
      await query.refetch(); toast.success(text("Document verwijderd.", "Document deleted."));
    } catch { await query.refetch(); toast.error(text("Document kon niet volledig worden verwijderd.", "Document could not be deleted completely.")); }
    finally { setBusy(""); }
  }

  async function update(document: TripDocument, changes: Partial<Pick<TripDocument, "document_type" | "travel_item_id" | "expires_on">>) {
    if (!editable) return;
    setBusy(document.id);
    try {
      const { error } = await db.from("trip_documents").update(changes).eq("id", document.id).eq("trip_uuid", tripId);
      if (error) throw error;
      await query.refetch();
      toast.success(text("Documentgegevens bijgewerkt.", "Document details updated."));
    } catch { toast.error(text("Documentgegevens konden niet worden bijgewerkt.", "Document details could not be updated.")); }
    finally { setBusy(""); }
  }

  const labels: Record<DocumentType, string> = { ticket: text("Ticket", "Ticket"), voucher: "Voucher", insurance: text("Verzekering", "Insurance"), visa: text("Visum", "Visa"), booking: text("Boekingsbevestiging", "Booking confirmation"), other: text("Overig", "Other") };
  const travelItemNames = new Map((travelItemsQuery.data ?? []).map((item) => [item.id, item.title]));
  return <Card className="surface"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5" />{text("Reisdocumenten", "Trip documents")}</CardTitle></CardHeader><CardContent className="space-y-4">
    {preview && <TripDocumentViewer tripId={tripId} title={preview.file_name} documents={(query.data ?? []).filter(document => document.id === preview.id)} onClose={() => setPreview(undefined)}/>}
    {uploadError && <p role="alert" className="text-sm text-destructive">{text("Opslag is niet bevestigd.", "Saving is unconfirmed.")} <Button type="button" variant="outline" size="sm" disabled={Boolean(busy) || !editable} onClick={() => void upload()}>{text("Dezelfde upload opnieuw proberen", "Retry the same upload")}</Button></p>}
    {editable && <fieldset disabled={Boolean(busy) || uploadError}><div className="grid gap-2 lg:grid-cols-[minmax(140px,auto)_minmax(180px,1fr)_minmax(150px,auto)_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as DocumentType)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={travelItemId} onChange={(event) => setTravelItemId(event.target.value)} disabled={travelItemsQuery.isLoading}><option value="">{text("Algemeen reisdocument", "General trip document")}</option>{travelItemsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input type="date" className="h-10 rounded-md border bg-background px-3 text-sm" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} aria-label={text("Vervaldatum", "Expiry date")} /><label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground"><Paperclip className="size-4" />{busy === "upload" ? text("Uploaden…", "Uploading…") : text("Document toevoegen", "Add document")}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div></fieldset>}
    {query.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{text("Documenten laden…", "Loading documents…")}</p> : query.isError ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text("Reisdocumenten konden niet worden geladen. Vernieuw de pagina of probeer het later opnieuw.", "Trip documents could not be loaded. Refresh the page or try again later.")}</p> : query.data?.length ? <div className="grid gap-2">{query.data.map((document) => <div key={document.id} className="flex min-w-0 items-center gap-3 rounded-xl border p-3"><FileText className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{document.file_name}</p><p className="truncate text-xs text-muted-foreground">{labels[document.document_type]}{document.travel_item_id && travelItemNames.get(document.travel_item_id) ? ` · ${travelItemNames.get(document.travel_item_id)}` : ""}{document.size_bytes ? ` · ${(document.size_bytes / 1024 / 1024).toFixed(1)} MB` : ""}</p>{editable && <div className="mt-2 grid gap-2 sm:grid-cols-3"><select className="h-8 min-w-0 rounded-md border bg-background px-2 text-xs" value={document.document_type} disabled={Boolean(busy)} onChange={(event) => void update(document, { document_type: event.target.value as DocumentType })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="h-8 min-w-0 rounded-md border bg-background px-2 text-xs" value={document.travel_item_id ?? ""} disabled={Boolean(busy)} onChange={(event) => void update(document, { travel_item_id: event.target.value || null })}><option value="">{text("Algemeen", "General")}</option>{travelItemsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input type="date" className="h-8 min-w-0 rounded-md border bg-background px-2 text-xs" value={document.expires_on ?? ""} disabled={Boolean(busy)} onChange={(event) => void update(document, { expires_on: event.target.value || null })} aria-label={text("Vervaldatum", "Expiry date")} /></div>}</div><Button size="icon" variant="ghost" disabled={Boolean(busy)} onClick={event => { event.currentTarget.focus(); setPreview(document); }} title={text("Openen", "Open")}><Eye className="size-4" /></Button>{editable && <Button size="icon" variant="ghost" disabled={Boolean(busy)} onClick={() => void remove(document)} title={text("Verwijderen", "Delete")}><Trash2 className="size-4" /></Button>}</div>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text("Nog geen documenten aan deze reis gekoppeld.", "No documents linked to this trip yet.")}</p>}
    <p className="text-xs text-muted-foreground">{text("Bestanden blijven privé. Openen controleert je toegang en toont een tijdelijk voorbeeld op dit apparaat.", "Files stay private. Opening checks your access and shows a temporary preview on this device.")}</p>
  </CardContent></Card>;
}
