import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { documentPreviewMime, type TripDocument } from "@/lib/trip-document-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TripDocumentViewer({ tripId, documents, title, onClose }: {
  tripId: string; documents: TripDocument[]; title: string; onClose: () => void;
}) {
  const { text } = useLocale(), { user } = useAuth();
  const opener = useRef(globalThis.document.activeElement as HTMLElement | null);
  const [selected, setSelected] = useState(documents[0]?.id ?? ""), [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<{ id: string; userId: string; url: string; mime: string }>();
  const [error, setError] = useState("");
  const document = documents.find(item => item.id === selected) ?? documents[0];
  const id = document?.id, path = document?.storage_path, userId = user?.id;
  useEffect(() => {
    let active = true, url = "";
    setPreview(undefined); setError("");
    if (!id || !path || !userId) return;
    if (!path.startsWith(tripId + "/") || path.split("/").some(part => part === "..")) {
      setError("unavailable"); return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    void (async () => {
      try {
        // Authenticated private Storage read on every open. No public or persistent signed URL.
        const result = await supabase.storage.from("trip-documents").download(path, {}, { cache: "no-store", signal: controller.signal });
        if (result.error || !result.data) throw Error("DOCUMENT_PREVIEW_UNAVAILABLE");
        const mime = documentPreviewMime(result.data);
        if (!active) return;
        url = URL.createObjectURL(result.data);
        setPreview({ id, userId, url, mime });
      } catch { if (active) setError("unavailable"); }
      finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); if (url) URL.revokeObjectURL(url); };
  }, [id, path, userId, tripId, retry]);
  const shown = preview?.id === id && preview?.userId === userId ? preview : undefined;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent data-document-viewer onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} className="flex max-h-[92dvh] w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden sm:max-w-5xl">
      <DialogHeader className="shrink-0 pr-8"><DialogTitle>{text("Documenten", "Documents")}</DialogTitle><DialogDescription className="break-words">{title}</DialogDescription></DialogHeader>
      <div className={`grid min-h-0 gap-3 overflow-auto ${documents.length > 1 ? "md:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        {documents.length > 1 && <nav aria-label={text("Gekoppelde documenten", "Linked documents")} className="flex gap-2 overflow-auto md:flex-col">
          {documents.map(item => <Button key={item.id} type="button" variant={item.id === id ? "secondary" : "ghost"} aria-pressed={item.id === id} className="h-auto shrink-0 justify-start whitespace-normal break-all text-left" onClick={() => setSelected(item.id)}><FileText className="size-4 shrink-0"/>{item.file_name}</Button>)}
        </nav>}
        <section className="min-w-0 space-y-3" aria-label={text("Documentvoorbeeld", "Document preview")}>
          {!document ? <p>{text("Geen documenten meer beschikbaar.", "No documents remain available.")}</p>
            : !userId ? <p role="alert">{text("Log opnieuw in om dit document te bekijken.", "Sign in again to view this document.")}</p>
            : error ? <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm"><p>{text("Het document kon niet worden geopend. Controleer je verbinding en toegang en probeer opnieuw.", "The document could not be opened. Check your connection and access, then retry.")}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>{text("Opnieuw proberen", "Retry")}</Button></div>
            : !shown ? <p role="status" className="flex items-center gap-2 p-6 text-sm"><Loader2 className="size-4 animate-spin"/>{text("Document laden…", "Loading document…")}</p>
            : <>
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="min-w-0 flex-1 break-all">{document.file_name}</span><Button variant="outline" size="sm" asChild><a href={shown.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4"/>{text("Nieuw tabblad", "New tab")}</a></Button><Button variant="outline" size="sm" asChild><a href={shown.url} download={document.file_name}><Download className="size-4"/>{text("Downloaden", "Download")}</a></Button></div>
              {shown.mime === "application/pdf" ? <><iframe title={document.file_name} src={shown.url} referrerPolicy="no-referrer" className="h-[60dvh] min-h-64 w-full rounded-lg border bg-white"/><p className="text-xs text-muted-foreground">{text("Geen PDF-weergave in deze browser? Open het document in een nieuw tabblad.", "No PDF preview in this browser? Open the document in a new tab.")}</p></>
                : <div className="flex h-[60dvh] min-h-64 items-center justify-center overflow-auto rounded-lg border bg-muted/20"><img src={shown.url} alt={document.file_name} className="max-h-full max-w-full object-contain"/></div>}
            </>}
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
