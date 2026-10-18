import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CloudOff, Database, Download, ExternalLink, FileText, RefreshCw, Trash2, Wifi } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Expense, Trip } from "@/lib/types";
import { createOfflineTripPack, deleteOfflineDocument, deleteOfflineTrip, getOfflineTrip, listOfflineDocuments, offlineStorageUsage, openOfflineDocument, removeQueuedOfflineExpenses, saveOfflineDocument, saveOfflineTrip, summarizeOfflineTripPack, type OfflineDocument, type OfflineTripPack } from "@/lib/offline-trip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { findOfflineExpenseConflicts } from "@/lib/offline-trip";

type Props = { trip: Trip; text: (nl: string, en: string) => string; canManageExpenses: boolean; payers: Array<{ id: string; name: string }>; syncExpenses: (expenses: Expense[]) => Promise<void> };

export function TripOfflinePack({ trip, text, canManageExpenses, payers, syncExpenses }: Props) {
  const [pack, setPack] = useState<OfflineTripPack>();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [persistentStorage, setPersistentStorage] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [offlineDocuments, setOfflineDocuments] = useState<OfflineDocument[]>([]);
  const [deviceUsage, setDeviceUsage] = useState({ documents: 0, trips: 0, quota: 0, browserUsage: 0 });
  const documentsQuery = useQuery({ queryKey: ["trip-documents-offline", trip.id], queryFn: async () => { const { data, error } = await (supabase as any).from("trip_documents").select("id,storage_path,file_name,mime_type,size_bytes").eq("trip_uuid", trip.id).order("created_at"); if (error) throw error; return data ?? []; }, retry: false });
  const savedAt = pack?.savedAt;
  const queued = useMemo(() => pack?.queuedExpenses ?? [], [pack?.queuedExpenses]);
  const summary = pack ? summarizeOfflineTripPack(pack) : undefined;
  const conflicts = useMemo(() => new Set(findOfflineExpenseConflicts(trip.expenses, queued)), [queued, trip.expenses]);

  useEffect(() => {
    setSelectedExpenses((current) => new Set(queued.filter((item) => !conflicts.has(item.id) && (current.size === 0 || current.has(item.id))).map((item) => item.id)));
  }, [conflicts, queued]);

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void getOfflineTrip(trip.id).then(setPack).catch(() => undefined);
      void navigator.storage?.persisted?.().then(setPersistentStorage).catch(() => undefined);
      void Promise.all([listOfflineDocuments(trip.id), offlineStorageUsage(), navigator.storage?.estimate?.()]).then(([documents, usage, estimate]) => { setOfflineDocuments(documents); setDeviceUsage({ ...usage, quota: estimate?.quota ?? 0, browserUsage: estimate?.usage ?? 0 }); }).catch(() => undefined);
    };
    void refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); window.removeEventListener("focus", refresh); };
  }, [trip.id]);

  async function save() {
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator)) throw new Error("OFFLINE_UNAVAILABLE");
      await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const persisted = await navigator.storage?.persist?.().catch(() => false);
      setPersistentStorage(persisted);
      const previous = await getOfflineTrip(trip.id);
      const pack = createOfflineTripPack(trip, document.documentElement.lang, canManageExpenses ? payers : [], previous?.queuedExpenses ?? []);
      await saveOfflineTrip(pack);
      setPack(pack);
      toast.success(text("Offline dagoverzicht is bijgewerkt.", "Offline day view updated."));
    } catch {
      toast.error(text("Offline opslaan wordt niet ondersteund door deze browser.", "Offline storage is not supported by this browser."));
    } finally {
      setBusy(false);
    }
  }

  async function saveDocuments() {
    const chosen = (documentsQuery.data ?? []).filter((document: any) => selectedDocuments.has(document.id));
    if (!chosen.length || !online) return;
    const expected = chosen.reduce((sum: number, document: any) => sum + Number(document.size_bytes ?? 0), 0);
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota && estimate.usage !== undefined && expected > estimate.quota - estimate.usage) {
      toast.error(text("Er is onvoldoende browseropslag voor deze documenten.", "There is not enough browser storage for these documents.")); return;
    }
    setBusy(true);
    try {
      for (const document of chosen) {
        const { data, error } = await supabase.storage.from("trip-documents").createSignedUrl(document.storage_path, 120);
        if (error || !data?.signedUrl) throw error;
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("OFFLINE_DOCUMENT_DOWNLOAD_FAILED");
        await saveOfflineDocument({ id: document.id, tripId: trip.id, fileName: document.file_name, mimeType: document.mime_type || response.headers.get("content-type") || "application/octet-stream", blob: await response.blob() });
      }
      setOfflineDocuments(await listOfflineDocuments(trip.id));
      const usage = await offlineStorageUsage(); setDeviceUsage((current) => ({ ...current, ...usage }));
      setSelectedDocuments(new Set());
      toast.success(text("De gekozen documenten zijn versleuteld offline opgeslagen.", "The selected documents were encrypted and saved offline."));
    } catch { toast.error(text("Niet alle documenten konden offline worden opgeslagen.", "Not all documents could be saved offline.")); }
    finally { setBusy(false); }
  }

  async function viewOfflineDocument(document: OfflineDocument) {
    try { const blob = await openOfflineDocument(document.id); const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch { toast.error(text("Het offline document kon niet worden ontsleuteld.", "The offline document could not be decrypted.")); }
  }

  async function removeOfflineDocument(document: OfflineDocument) { await deleteOfflineDocument(document.id); setOfflineDocuments((current) => current.filter((item) => item.id !== document.id)); const usage = await offlineStorageUsage(); setDeviceUsage((current) => ({ ...current, ...usage })); }

  async function remove() {
    setBusy(true);
    try {
      await deleteOfflineTrip(trip.id);
      setPack(undefined);
      toast.success(text("Offline gegevens zijn van dit apparaat verwijderd.", "Offline data removed from this device."));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    const chosen = queued.filter((item) => selectedExpenses.has(item.id) && !conflicts.has(item.id));
    if (!chosen.length || !online) return;
    setBusy(true);
    try {
      await syncExpenses(chosen.map(({ queuedAt: _queuedAt, ...expense }) => expense));
      await removeQueuedOfflineExpenses(trip.id, chosen.map((item) => item.id));
      setPack((current) => current ? { ...current, queuedExpenses: current.queuedExpenses.filter((item) => !selectedExpenses.has(item.id)) } : current);
      setSelectedExpenses(new Set());
      toast.success(text("Offline uitgaven zijn gesynchroniseerd.", "Offline expenses have been synced."));
    } catch {
      toast.error(text("Synchroniseren is gestopt. De lokale uitgaven blijven bewaard; herlaad de reis en probeer opnieuw.", "Sync stopped. Your local expenses remain saved; reload the trip and try again."), { duration: 8000 });
    } finally { setBusy(false); }
  }

  async function removeQueued(id: string) {
    await removeQueuedOfflineExpenses(trip.id, [id]);
    setPack((current) => current ? { ...current, queuedExpenses: current.queuedExpenses.filter((item) => item.id !== id) } : current);
    setSelectedExpenses((current) => { const next = new Set(current); next.delete(id); return next; });
  }

  async function keepLocalExpenseAsNew(id: string) {
    const current = await getOfflineTrip(trip.id);
    if (!current) return;
    current.queuedExpenses = current.queuedExpenses.map((item) => item.id === id
      ? { ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() }
      : item);
    await saveOfflineTrip(current);
    setPack(current);
    toast.success(text("De lokale versie staat als nieuwe uitgave in de wachtrij.", "The local version is queued as a new expense."));
  }

  return <Card id="trip-offline-pack" className="surface">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base"><Download className="size-4"/>{text("Offline onderweg", "Offline on the go")}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{text(
        "Bewaar route, dagplanning en praktische boekingsinformatie. Alleen documenten die je hieronder zelf kiest worden versleuteld op dit apparaat opgeslagen.",
        "Save routes, daily plans and practical booking details. Only documents you select below are stored encrypted on this device.",
      )}</p>
      {savedAt && <p className="text-xs text-muted-foreground">{text("Bijgewerkt", "Updated")}: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(savedAt))}</p>}
      {summary && <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-3">
          <span className="flex items-center gap-1.5 font-medium"><Database className="size-3.5"/>{text("Op dit apparaat", "On this device")}</span>
          <p className="mt-1 text-muted-foreground">{formatBytes(summary.bytes)} · {summary.stops} {text("bestemmingen", "destinations")} · {summary.itineraryItems} {text("planningitems", "itinerary items")} · {summary.bookings} {text("boekingen", "bookings")}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <span className="flex items-center gap-1.5 font-medium">{online ? <Wifi className="size-3.5"/> : <CloudOff className="size-3.5"/>}{online ? text("Online", "Online") : text("Offline", "Offline")}</span>
          <p className="mt-1 text-muted-foreground">{queued.length ? `${queued.length} ${text("uitgave(n) wachten op synchronisatie", "expense(s) waiting to sync")}` : text("Alles op dit apparaat is bijgewerkt.", "Everything on this device is up to date.")}</p>
        </div>
        {persistentStorage !== undefined && <div className="flex items-center gap-1.5 text-muted-foreground sm:col-span-2">
          <CircleCheck className="size-3.5"/>{persistentStorage
            ? text("De browser beschermt dit offline pakket tegen automatische opschoning.", "The browser protects this offline pack from automatic cleanup.")
            : text("De browser kan lokale gegevens bij ruimtegebrek opruimen. Werk het pakket voor vertrek opnieuw bij.", "The browser may clear local data when storage is low. Update the pack again before departure.")}
        </div>}
      </div>}
      <div className="space-y-2 rounded-lg border p-3">
        <strong className="flex items-center gap-2 text-sm"><FileText className="size-4"/>{text("Gekozen documenten offline", "Selected documents offline")}</strong>
        <p className="text-xs text-muted-foreground">{text("Selecteer alleen documenten die je op dit apparaat nodig hebt. De verwachte download is", "Select only documents you need on this device. Expected download is")} {formatBytes((documentsQuery.data ?? []).filter((item:any)=>selectedDocuments.has(item.id)).reduce((sum:number,item:any)=>sum+Number(item.size_bytes??0),0))}.</p>
        {(documentsQuery.data ?? []).map((document:any) => { const stored=offlineDocuments.some((item)=>item.id===document.id); return <label key={document.id} className="flex items-center gap-2 rounded-md bg-muted/30 p-2 text-sm"><Checkbox checked={selectedDocuments.has(document.id)} disabled={stored||busy} onCheckedChange={(checked)=>setSelectedDocuments((current)=>{const next=new Set(current);if(checked)next.add(document.id);else next.delete(document.id);return next})}/><span className="min-w-0 flex-1 truncate">{document.file_name} · {formatBytes(Number(document.size_bytes??0))}</span>{stored&&<span className="text-xs text-emerald-700">{text("op apparaat","on device")}</span>}</label>})}
        {documentsQuery.data?.length ? <Button size="sm" variant="secondary" disabled={busy||!online||!selectedDocuments.size} onClick={()=>void saveDocuments()}><Download className="size-4"/>{text("Keuze downloaden", "Download selection")}</Button> : <p className="text-xs text-muted-foreground">{text("Deze reis heeft geen beschikbare documenten.", "This trip has no available documents.")}</p>}
        {offlineDocuments.map((document)=><div key={document.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><span className="min-w-0 flex-1 truncate">{document.fileName} · {formatBytes(document.size)}</span><Button size="sm" variant="outline" onClick={()=>void viewOfflineDocument(document)}>{text("Openen","Open")}</Button><Button size="icon" variant="ghost" onClick={()=>void removeOfflineDocument(document)}><Trash2 className="size-4"/></Button></div>)}
      </div>
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground"><strong className="text-foreground">{text("Opslag op dit apparaat", "Storage on this device")}</strong><p className="mt-1">{text("Deze reizen", "These trips")}: {formatBytes(deviceUsage.trips)} · {text("documenten", "documents")}: {formatBytes(deviceUsage.documents)}{deviceUsage.quota ? ` · ${text("browser totaal", "browser total")}: ${formatBytes(deviceUsage.browserUsage)} / ${formatBytes(deviceUsage.quota)}` : ""}</p></div>
      {queued.length > 0 && <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><strong>{text("Synchronisatiewachtrij · uitgaven", "Sync queue · expenses")} ({queued.length})</strong><p className="text-xs">{text("Kies wat je synchroniseert. Los een conflict op door de serverversie te behouden of de lokale invoer als nieuwe uitgave klaar te zetten.", "Choose what to sync. Resolve a conflict by keeping the server version or queuing the local entry as a new expense.")}</p>{queued.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md bg-background/80 p-2 text-foreground"><Checkbox checked={selectedExpenses.has(item.id)} disabled={conflicts.has(item.id)} onCheckedChange={(checked) => setSelectedExpenses((current) => { const next = new Set(current); if (checked) next.add(item.id); else next.delete(item.id); return next; })} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{item.date} · {item.currency} {item.amount.toFixed(2)}{conflicts.has(item.id) ? ` · ${text("conflict", "conflict")}` : ""}</span></span>{conflicts.has(item.id) && <><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void removeQueued(item.id)}>{text("Server behouden", "Keep server")}</Button><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void keepLocalExpenseAsNew(item.id)}>{text("Lokaal als nieuw", "Local as new")}</Button></>}<Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => void removeQueued(item.id)} title={text("Lokale uitgave verwijderen", "Remove local expense")}><Trash2 className="size-4" /></Button></div>)}</div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
          {savedAt ? <RefreshCw className="size-4"/> : <Download className="size-4"/>}
          {savedAt ? text("Bijwerken", "Update") : text("Offline bewaren", "Save offline")}
        </Button>
        {savedAt && <>
          <Button type="button" size="sm" variant="outline" asChild><a href={`/offline.html?trip=${encodeURIComponent(trip.id)}`}><ExternalLink className="size-4"/>{text("Open offline overzicht", "Open offline view")}</a></Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}><Trash2 className="size-4"/>{text("Verwijderen", "Remove")}</Button>
        </>}
        {queued.length > 0 && canManageExpenses && <Button type="button" size="sm" variant="secondary" onClick={() => void sync()} disabled={busy || !online || selectedExpenses.size === 0}><RefreshCw className="size-4"/>{text(`${selectedExpenses.size} synchroniseren`, `Sync ${selectedExpenses.size}`)}</Button>}
      </div>
    </CardContent>
  </Card>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
